// api/services/pterodactylService.js (SELALU BUAT USER BARU - Password = ptero_username + 123)
const axios = require('axios');

const PTERO_URL = process.env.PTERO_API_URL + '/api/application';
const API_KEY = process.env.PTERO_APP_KEY;

const pteroApi = axios.create({
    baseURL: PTERO_URL,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 15000
});

/**
 * SELALU Membuat user Pterodactyl BARU untuk setiap server.
 * Menggunakan username acak dan password = username_pterodactyl + "123".
 * @param {string} websiteUsername - Username user dari website (untuk nama depan)
 * @param {string} serverName - Nama server yang dibeli (untuk username acak)
 * @returns {Promise<object>} - Objek user Pterodactyl BARU (termasuk id dan password)
 */
const createNewPteroUserForServer = async (websiteUsername, serverName) => {
    // Buat username & email unik acak
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const baseUsername = serverName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toLowerCase();
    const pteroUsername = `srv_${baseUsername}_${randomSuffix}`;
    const pteroEmail = `${pteroUsername}@manzzyid-server.com`;
    // **PASSWORD = USERNAME PTERO + 123**
    const constructedPassword = pteroUsername + "123";

    try {
        console.log(`Membuat user Pterodactyl baru: ${pteroUsername}`);
        const createUserResponse = await pteroApi.post('/users', {
            email: pteroEmail,
            username: pteroUsername, // Username Ptero
            first_name: websiteUsername, // Nama depan dari username website
            last_name: "Server",
            password: constructedPassword, // Gunakan password konstruksi
        });

        const newUser = createUserResponse.data.attributes;
        console.log(`User Pterodactyl baru berhasil dibuat: ID ${newUser.id}`);
        // Kembalikan data user BARU termasuk PASSWORD konstruksi
        return { ...newUser, password: constructedPassword };

    } catch (error) {
        console.error("Error saat createNewPteroUserForServer:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        if (error.response?.data?.errors?.[0]?.code === 'UsernameTakenException' || error.response?.data?.errors?.[0]?.code === 'EmailTakenException') {
            throw new Error('Gagal membuat user Pterodactyl: Username/Email acak sudah terpakai. Coba lagi.');
        }
        throw new Error('Gagal membuat user baru di Pterodactyl Panel.');
    }
};

/**
 * Mengambil Detail Egg dari Pterodactyl API.
 * (Fungsi ini tidak berubah)
 */
const getEggDetails = async (nestId, eggId) => {
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
     try {
        console.log(`Mengirim sinyal ${signal} ke server Pterodactyl ID: ${serverId}`);
        await pteroApi.post(`/servers/${serverId}/power`, { signal });
        console.log(`Sinyal ${signal} berhasil dikirim.`);
    } catch (error) {
        console.error(`Error saat mengirim sinyal ${signal} ke server ${serverId}:`, error.response ? error.response.data : error.message);
        throw new Error(`Gagal mengirim sinyal ${signal} ke server.`);
    }
};

// Hapus fungsi generateStrongRandomPassword
// function generateStrongRandomPassword(length = 14) { ... }

module.exports = {
    createNewPteroUserForServer, // Pastikan ini yang di-export
    getEggDetails,
    createNewServer,
    sendServerCommand
};
