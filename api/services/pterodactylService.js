// api/services/pterodactylService.js (Password = ptero_username + 123 - TIDAK AMAN!)
const axios = require('axios');

const PTERO_URL = process.env.PTERO_API_URL + '/api/application';
const API_KEY = process.env.PTERO_APP_KEY;

const pteroApi = axios.create({
    baseURL: PTERO_URL,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 15000
});

/**
 * Mencari user di Pterodactyl berdasarkan email. Jika tidak ditemukan, buat user baru
 * dengan password = username_pterodactyl + "123".
 * @param {object} user - Objek user dari database MongoDB Anda (harus punya username)
 * @returns {Promise<object>} - Objek user Pterodactyl (termasuk 'id', 'existing', dan 'password' jika baru)
 */
const getOrCreatePteroUser = async (user) => {
    // Buat email & username Pterodactyl
    const userEmail = `${user.username.replace(/[^a-zA-Z0-9]/g, '')}@manzzyid.com`;
    const pteroUsername = user.username.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15); // Username Ptero
    // **PASSWORD BARU (pteroUsername + 123)**
    const constructedPassword = pteroUsername + "123";

    try {
        // 1. Coba Cari User
        console.log(`Mencari user Pterodactyl dengan email: ${userEmail} atau username: ${pteroUsername}`);
        let searchResponse = await pteroApi.get(`/users?filter[email]=${encodeURIComponent(userEmail)}`);

        if (searchResponse.data.data.length > 0) {
            const existingUser = searchResponse.data.data[0].attributes;
            console.log(`User Pterodactyl ditemukan (via email): ID ${existingUser.id}`);
            return { ...existingUser, existing: true }; // Kembalikan tanpa password
        }

        searchResponse = await pteroApi.get(`/users?filter[username]=${encodeURIComponent(pteroUsername)}`);
        if (searchResponse.data.data.length > 0) {
            const existingUser = searchResponse.data.data[0].attributes;
            console.log(`User Pterodactyl ditemukan (via username): ID ${existingUser.id}`);
            return { ...existingUser, existing: true }; // Kembalikan tanpa password
        }

        // 2. Buat User Baru
        console.log(`User Pterodactyl tidak ditemukan, membuat user baru dengan password predictable...`);

        const createUserResponse = await pteroApi.post('/users', {
            email: userEmail,
            username: pteroUsername, // Gunakan username Ptero
            first_name: user.username, // Nama depan bisa username asli website
            last_name: 'User',
            password: constructedPassword, // <-- Gunakan password konstruksi (pteroUsername + 123)
        });

        const newUser = createUserResponse.data.attributes;
        console.log(`User Pterodactyl baru berhasil dibuat: ID ${newUser.id}`);
        // Kembalikan data user BARU termasuk PASSWORD konstruksi
        return { ...newUser, existing: false, password: constructedPassword };

    } catch (error) {
        console.error("Error saat getOrCreatePteroUser:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error('Gagal mencari atau membuat user di Pterodactyl Panel.');
    }
};

/**
 * Mengambil Detail Egg dari Pterodactyl API.
 * (Fungsi ini tidak berubah)
 */
const getEggDetails = async (nestId, eggId) => {
    // ... (Kode getEggDetails tetap sama) ...
     try {
        console.log(`Mengambil detail Egg ID: ${eggId} dari Nest ID: ${nestId}`);
        const response = await pteroApi.get(`/nests/${nestId}/eggs/${eggId}?include=variables`);
        if (!response.data || !response.data.attributes) { throw new Error('Data Egg tidak valid.'); }
        console.log("Detail Egg berhasil diambil.");
        const attributes = response.data.attributes;
        const defaultEnv = {};
        if (response.data.relationships?.variables?.data) {
             response.data.relationships.variables.data.forEach(v => {
                 defaultEnv[v.attributes.env_variable] = v.attributes.default_value;
             });
        }
        attributes.default_environment = defaultEnv;
        return attributes;
    } catch (error) {
        console.error(`Error saat getEggDetails (Nest: ${nestId}, Egg: ${eggId}):`, error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        throw new Error(`Gagal mengambil detail konfigurasi Egg (ID: ${eggId}) dari Pterodactyl.`);
    }
};


/**
 * Membuat server baru di Pterodactyl.
 * (Fungsi ini tidak berubah)
 */
const createNewServer = async (pteroUserId, serverName, packageConfig) => {
     // ... (Kode createNewServer tetap sama, menggunakan deploy locations dan egg dinamis) ...
    try {
        console.log(`Membuat server Pterodactyl untuk user ID: ${pteroUserId}, nama: ${serverName}, lokasi: ${packageConfig.locationId}`);
        const eggDetails = await getEggDetails(packageConfig.nestId, packageConfig.eggId);
        const serverData = {
            name: serverName, user: pteroUserId, egg: packageConfig.eggId,
            docker_image: eggDetails.docker_image, startup: eggDetails.startup,
            environment: { ...eggDetails.default_environment, ...(packageConfig.environment || {}) },
            limits: packageConfig.limits, feature_limits: packageConfig.feature_limits,
            deploy: { locations: [packageConfig.locationId], dedicated_ip: false, port_range: [] },
            start_on_completion: true
        };
        if (!packageConfig.locationId) { throw new Error("Konfigurasi ID Lokasi wajib ada."); }
        if (serverData.startup && serverData.startup.includes('${CMD_RUN}') && !serverData.environment.CMD_RUN) { throw new Error("Konfigurasi paket harus menyertakan environment.CMD_RUN"); }
        const response = await pteroApi.post('/servers', serverData);
        const newServer = response.data.attributes;
        console.log(`Server Pterodactyl berhasil dibuat: ID ${newServer.id}`);
        return newServer.id;
    } catch (error) {
        console.error("Error saat createNewServer:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        let detailError = 'Gagal membuat server. Cek konfigurasi paket/API Key/Lokasi/Egg.';
        if (error.response?.data?.errors) { detailError = error.response.data.errors.map(e => e.detail).join(' '); }
        if (error.message.includes("Gagal mengambil detail")) { detailError = error.message; }
        throw new Error(detailError);
    }
};

/**
 * Mengirim perintah power ke server Pterodactyl.
 * (Fungsi ini tidak berubah)
 */
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

// Fungsi generateRandomPassword tidak lagi diperlukan

module.exports = {
    getOrCreatePteroUser,
    getEggDetails,
    createNewServer,
    sendServerCommand
}; // Pastikan kurung kurawal penutup module.exports ada
