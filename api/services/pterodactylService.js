// api/services/pterodactylService.js (Implementasi User & Egg Dinamis & Deploy Locations)
const axios = require('axios');

const PTERO_URL = process.env.PTERO_API_URL + '/api/application';
const API_KEY = process.env.PTERO_APP_KEY;

const pteroApi = axios.create({
    baseURL: PTERO_URL,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 15000 // Timeout dinaikkan
});

// --- Fungsi getOrCreatePteroUser (Tetap Sama) ---
const getOrCreatePteroUser = async (user) => {
    // ... (Kode getOrCreatePteroUser dari balasan sebelumnya, tidak berubah) ...
    const userEmail = `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@manzzyid.com`; 
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

// --- FUNGSI BARU: Mengambil Detail Egg ---
const getEggDetails = async (nestId, eggId) => {
    try {
        console.log(`Mengambil detail Egg ID: ${eggId} dari Nest ID: ${nestId}`);
        // Endpoint Pterodactyl untuk detail Egg
        const response = await pteroApi.get(`/nests/${nestId}/eggs/${eggId}?include=variables`); 
        
        if (!response.data || !response.data.attributes) {
            throw new Error('Data Egg tidak valid diterima dari API Pterodactyl.');
        }
        console.log("Detail Egg berhasil diambil.");
        return response.data.attributes; // Mengembalikan detail Egg (termasuk docker_image, startup, environment variables)
    } catch (error) {
        console.error(`Error saat getEggDetails (Nest: ${nestId}, Egg: ${eggId}):`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error(`Gagal mengambil detail konfigurasi Egg (ID: ${eggId}) dari Pterodactyl.`);
    }
};


// --- Fungsi createNewServer (DIUBAH UNTUK MENGAMBIL EGG DETAILS & PAKAI LOCATIONS) ---
const createNewServer = async (pteroUserId, serverName, packageConfig) => {
    try {
        console.log(`Membuat server Pterodactyl untuk user ID: ${pteroUserId}, nama: ${serverName}, lokasi: ${packageConfig.locationId}`);

        // 1. Ambil Detail Egg secara Dinamis
        const eggDetails = await getEggDetails(packageConfig.nestId, packageConfig.eggId);

        // 2. Siapkan Data Server (Menggunakan detail dari Egg)
        const serverData = {
            name: serverName,
            user: pteroUserId,
            egg: packageConfig.eggId,
            // Mengambil dari Egg Details
            docker_image: eggDetails.docker_image, 
            startup: eggDetails.startup, 
            // Menggabungkan environment dari paket (jika ada) dengan default dari Egg
            environment: { ...eggDetails.script.environment, ...(packageConfig.environment || {}) }, 
            limits: packageConfig.limits, 
            feature_limits: packageConfig.feature_limits,
            // Menggunakan deploy.locations
            deploy: {
                locations: [packageConfig.locationId], 
                dedicated_ip: false, 
                port_range: [] 
            },
            start_on_completion: true
        };

        // Validasi wajib ada location ID
        if (!packageConfig.locationId) {
             console.error("FATAL: locationId tidak ditemukan dalam konfigurasi paket!");
             throw new Error("Konfigurasi ID Lokasi wajib ada.");
        }

        // 3. Kirim Request Pembuatan Server
        const response = await pteroApi.post('/servers', serverData);

        const newServer = response.data.attributes;
        console.log(`Server Pterodactyl berhasil dibuat: ID ${newServer.id}`);
        return newServer.id;
    } catch (error) {
        console.error("Error saat createNewServer:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        let detailError = 'Gagal membuat server di Pterodactyl Panel. Cek konfigurasi paket/API Key/Lokasi/Egg.';
        if (error.response && error.response.data && error.response.data.errors) {
            detailError = error.response.data.errors.map(e => e.detail).join(' ');
        }
        // Tambahkan detail error dari getEggDetails jika ada
        if (error.message.includes("Gagal mengambil detail konfigurasi Egg")) {
             detailError = error.message;
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
    getEggDetails, // Export fungsi baru
    createNewServer,
    sendServerCommand
};
