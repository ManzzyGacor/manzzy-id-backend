// api/services/pterodactylService.js (Implementasi User & Deploy Locations)
const axios = require('axios');

const PTERO_URL = process.env.PTERO_API_URL + '/api/application';
const API_KEY = process.env.PTERO_APP_KEY;

const pteroApi = axios.create({
    baseURL: PTERO_URL,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 15000 // Timeout dinaikkan sedikit untuk create server
});

// --- Fungsi getOrCreatePteroUser (Tetap Sama) ---
const getOrCreatePteroUser = async (user) => {
    // ... (Kode getOrCreatePteroUser dari balasan sebelumnya) ...
    const userEmail = `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@manzzy.web.id`; 
    const userUsername = user.username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15); 
    try {
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
        console.log(`User Pterodactyl tidak ditemukan, membuat user baru...`);
        const createUserResponse = await pteroApi.post('/users', { email: userEmail, username: userUsername, first_name: user.username, last_name: 'User', password: generateRandomPassword() });
        const newUser = createUserResponse.data.attributes;
        console.log(`User Pterodactyl baru berhasil dibuat: ID ${newUser.id}`);
        return newUser;
    } catch (error) {
        console.error("Error saat getOrCreatePteroUser:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error('Gagal mencari atau membuat user di Pterodactyl Panel.');
    }
};

// --- Fungsi createNewServer (DIUBAH UNTUK MENGIRIM DEPLOY LOCATIONS) ---
const createNewServer = async (pteroUserId, serverName, packageConfig) => {
    try {
        console.log(`Membuat server Pterodactyl untuk user ID: ${pteroUserId}, nama: ${serverName}, lokasi: ${packageConfig.locationId}`);

        // Data yang dikirim ke API Pterodactyl (MENGGUNAKAN deploy.locations)
        const serverData = {
            name: serverName,
            user: pteroUserId,
            egg: packageConfig.eggId,
            nest: packageConfig.nestId,
            docker_image: packageConfig.docker_image,
            startup: packageConfig.startup_command,
            environment: packageConfig.environment,
            limits: packageConfig.limits, // { memory, disk, cpu, swap, io }
            feature_limits: packageConfig.feature_limits, // { databases, backups, allocations }
            // MENGGANTI allocation.default DENGAN deploy.locations
            deploy: {
                locations: [packageConfig.locationId], // Kirim ID Lokasi dalam array
                dedicated_ip: false, // Biasanya false
                port_range: [] // Kosongkan agar Ptero pilih otomatis port
            },
            start_on_completion: true
        };

        // Validasi wajib ada location ID
        if (!packageConfig.locationId) {
             console.error("FATAL: locationId tidak ditemukan dalam konfigurasi paket!");
             throw new Error("Konfigurasi ID Lokasi wajib ada.");
        }

        const response = await pteroApi.post('/servers', serverData);

        const newServer = response.data.attributes;
        console.log(`Server Pterodactyl berhasil dibuat: ID ${newServer.id}`);
        return newServer.id;
    } catch (error) {
        console.error("Error saat createNewServer:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        let detailError = 'Gagal membuat server di Pterodactyl Panel. Cek konfigurasi paket/API Key/Lokasi.';
        if (error.response && error.response.data && error.response.data.errors) {
            detailError = error.response.data.errors.map(e => e.detail).join(' ');
        }
        throw new Error(detailError);
    }
};

// --- Fungsi sendServerCommand (Tetap Sama) ---
const sendServerCommand = async (serverId, signal) => {
    // ... (Kode sendServerCommand tetap sama) ...
    try {
        console.log(`Mengirim sinyal ${signal} ke server Pterodactyl ID: ${serverId}`);
        await pteroApi.post(`/servers/${serverId}/power`, { signal });
        console.log(`Sinyal ${signal} berhasil dikirim.`);
    } catch (error) {
        console.error(`Error saat mengirim sinyal ${signal} ke server ${serverId}:`, error.response ? error.response.data : error.message);
        throw new Error(`Gagal mengirim sinyal ${signal} ke server.`);
    }
};

// Helper function generate password (Tetap Sama)
function generateRandomPassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let password = ""; for (let i = 0, n = charset.length; i < length; ++i) { password += charset.charAt(Math.floor(Math.random() * n)); } return password;
}

module.exports = {
    getOrCreatePteroUser,
    createNewServer,
    sendServerCommand
};
