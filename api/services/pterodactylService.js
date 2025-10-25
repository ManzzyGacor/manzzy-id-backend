// api/services/pterodactylService.js (Implementasi User Pterodactyl Asli)
const axios = require('axios');

// Pastikan variabel ini ada di Environment Variables Vercel kamu
const PTERO_URL = process.env.PTERO_API_URL + '/api/application'; 
const API_KEY = process.env.PTERO_APP_KEY;

// Konfigurasi instance Axios untuk Pterodactyl API
const pteroApi = axios.create({
    baseURL: PTERO_URL,
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: 10000 // 10 detik timeout
});

/**
 * Mencari user di Pterodactyl berdasarkan email. Jika tidak ditemukan, buat user baru.
 * @param {object} user - Objek user dari database MongoDB Anda (harus punya username)
 * @returns {Promise<object>} - Objek user Pterodactyl (minimal berisi 'id')
 */
const getOrCreatePteroUser = async (user) => {
    // Buat email & username Pterodactyl yang valid dari username website
    const userEmail = `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@manzzyid.com`; 
    const userUsername = user.username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15); 

    try {
        // 1. Coba Cari User
        console.log(`Mencari user Pterodactyl dengan email: ${userEmail} atau username: ${userUsername}`);
        let searchResponse = await pteroApi.get(`/users?filter[email]=${encodeURIComponent(userEmail)}`);

        if (searchResponse.data.data.length > 0) {
            const existingUser = searchResponse.data.data[0].attributes;
            console.log(`User Pterodactyl ditemukan (via email): ID ${existingUser.id}`);
            return existingUser;
        }

        searchResponse = await pteroApi.get(`/users?filter[username]=${encodeURIComponent(userUsername)}`);
        if (searchResponse.data.data.length > 0) {
            const existingUser = searchResponse.data.data[0].attributes;
            console.log(`User Pterodactyl ditemukan (via username): ID ${existingUser.id}`);
            return existingUser;
        }

        // 2. Buat User Baru
        console.log(`User Pterodactyl tidak ditemukan, membuat user baru...`);
        const createUserResponse = await pteroApi.post('/users', {
            email: userEmail,
            username: userUsername,
            first_name: user.username, 
            last_name: 'User',        
            password: generateRandomPassword(), 
        });

        const newUser = createUserResponse.data.attributes;
        console.log(`User Pterodactyl baru berhasil dibuat: ID ${newUser.id}`);
        return newUser;

    } catch (error) {
        console.error("Error saat getOrCreatePteroUser:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error('Gagal mencari atau membuat user di Pterodactyl Panel.');
    }
};

/**
 * Membuat server baru di Pterodactyl.
 * @param {number} pteroUserId - ID User Pterodactyl
 * @param {string} serverName - Nama server yang diinginkan user
 * @param {object} packageConfig - Konfigurasi paket dari backend (eggId, nestId, limits, dll)
 * @returns {Promise<number>} - ID server Pterodactyl yang baru dibuat
 */
const createNewServer = async (pteroUserId, serverName, packageConfig) => {
    try {
        console.log(`Membuat server Pterodactyl untuk user ID: ${pteroUserId}, nama: ${serverName}`);
        
        // Data yang dikirim ke API Pterodactyl
        const serverData = {
            name: serverName,
            user: pteroUserId, // ID Pterodactyl User
            egg: packageConfig.eggId,
            nest: packageConfig.nestId,
            docker_image: packageConfig.docker_image || 'ghcr.io/pterodactyl/yolks:java_17', // Ganti default jika perlu
            startup: packageConfig.startup_command || 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar', // Ganti default jika perlu
            environment: packageConfig.environment || { SERVER_JARFILE: 'server.jar', BUKKIT_VERSION: 'latest' }, // Contoh env
            limits: packageConfig.limits, // { memory, disk, cpu, swap }
            feature_limits: packageConfig.feature_limits || { databases: 1, allocations: 1, backups: 1 }, // Contoh
            allocation: {
                default: packageConfig.default_allocation_id // WAJIB DIISI DARI PAKET!
            },
            start_on_completion: true
        };

        // Hapus field opsional jika tidak ada di paket
        if (!packageConfig.environment) delete serverData.environment;
        if (!packageConfig.startup_command) delete serverData.startup;
        if (!packageConfig.docker_image) delete serverData.docker_image;
        if (!packageConfig.feature_limits) delete serverData.feature_limits;
        if (!packageConfig.default_allocation_id) {
             console.error("FATAL: default_allocation_id tidak ditemukan dalam konfigurasi paket!");
             throw new Error("Konfigurasi alokasi default wajib ada.");
        }

        const response = await pteroApi.post('/servers', serverData);

        const newServer = response.data.attributes;
        console.log(`Server Pterodactyl berhasil dibuat: ID ${newServer.id}`);
        return newServer.id; // Mengembalikan ID server baru
    } catch (error) {
        console.error("Error saat createNewServer:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error('Gagal membuat server di Pterodactyl Panel. Cek konfigurasi paket/API Key/Alokasi.');
    }
};

/**
 * Mengirim perintah power (start/stop/restart/kill) ke server Pterodactyl.
 * @param {number} serverId - ID Server Pterodactyl
 * @param {string} signal - Perintah ('start', 'stop', 'restart', 'kill')
 */
const sendServerCommand = async (serverId, signal) => {
    try {
        console.log(`Mengirim sinyal ${signal} ke server Pterodactyl ID: ${serverId}`);
        await pteroApi.post(`/servers/${serverId}/power`, { signal });
        console.log(`Sinyal ${signal} berhasil dikirim.`);
    } catch (error) {
        console.error(`Error saat mengirim sinyal ${signal} ke server ${serverId}:`, error.response ? error.response.data : error.message);
        throw new Error(`Gagal mengirim sinyal ${signal} ke server.`);
    }
};

// Helper function untuk generate password acak
function generateRandomPassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let password = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        password += charset.charAt(Math.floor(Math.random() * n));
    }
    return password;
}

module.exports = {
    getOrCreatePteroUser,
    createNewServer,
    sendServerCommand
};
