// api/services/pterodactylService.js (SELALU BUAT USER BARU per Server - Password = ptero_username + 123)
const axios = require('axios');

// Pastikan variabel ini ada di Environment Variables Vercel kamu
const PTERO_URL = process.env.PTERO_API_URL + '/api/application';
const API_KEY = process.env.PTERO_APP_KEY;

// Konfigurasi instance Axios untuk Pterodactyl API
const pteroApi = axios.create({
    baseURL: PTERO_URL,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 15000 // Timeout dinaikkan
});

/**
 * SELALU Membuat user Pterodactyl BARU untuk setiap server.
 * Username & Password berdasarkan NAMA SERVER.
 * @param {string} websiteUsername - Username user dari website (hanya untuk nama depan)
 * @param {string} serverName - Nama server yang dibeli (untuk username Ptero & password)
 * @returns {Promise<object>} - Objek user Pterodactyl BARU (termasuk id dan password)
 */
const createNewPteroUserForServer = async (websiteUsername, serverName) => {
    // Buat username Ptero dari nama server (dibersihkan, maks ~15-30 char) + acak
    const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 char acak
    const baseUsername = serverName.replace(/[^a-zA-Z0-9_.]/g, '').substring(0, 15).toLowerCase();
    const pteroUsername = `${baseUsername}_${randomSuffix}`;

    // Buat email dummy unik
    const pteroEmail = `${pteroUsername}@manzzyid-server.com`;

    // **PASSWORD = USERNAME PTERO + 123**
    const constructedPassword = pteroUsername + "123";

    // Validasi dasar username Ptero
    if (!pteroUsername || pteroUsername.length < 3) {
        throw new Error("Nama server tidak valid untuk dijadikan username Pterodactyl (setelah dibersihkan). Coba nama yang lebih panjang/berbeda.");
    }

    try {
        console.log(`Membuat user Pterodactyl baru: ${pteroUsername}`);
        const createUserResponse = await pteroApi.post('/users', {
            email: pteroEmail,
            username: pteroUsername, // Username Ptero dari nama server + acak
            first_name: websiteUsername, // Nama depan dari username website
            last_name: "Server", // Nama belakang generik
            password: constructedPassword, // Gunakan password konstruksi
            language: 'en'
            // root_admin: false, // Defaultnya false
        });

        const newUser = createUserResponse.data.attributes;
        console.log(`User Pterodactyl baru berhasil dibuat: ID ${newUser.id}`);
        // Kembalikan data user BARU termasuk PASSWORD konstruksi
        return { ...newUser, password: constructedPassword };

    } catch (error) {
        console.error("Error saat createNewPteroUserForServer:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        // Tangkap error spesifik jika username/email sudah ada
        if (error.response?.data?.errors) {
            const detailError = error.response.data.errors.map(e => e.detail).join(' ');
             if (detailError.includes('already been taken')) {
                 throw new Error(`Gagal membuat user Pterodactyl: Username (${pteroUsername}) atau Email (${pteroEmail}) sudah terpakai. Coba nama server lain.`);
            }
            throw new Error(`Gagal membuat user Pterodactyl: ${detailError}`);
        }
        throw new Error('Gagal membuat user baru di Pterodactyl Panel. Periksa koneksi/API Key.');
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
        attributes.default_environment = defaultEnv; // Simpan env default di sini
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
            // Gabungkan environment dari paket (WAJIB ADA CMD_RUN) dengan default dari Egg
            environment: { ...eggDetails.default_environment, ...(packageConfig.environment || {}) },
            limits: packageConfig.limits, feature_limits: packageConfig.feature_limits,
            deploy: { locations: [packageConfig.locationId], dedicated_ip: false, port_range: [] },
            start_on_completion: true
        };
        if (!packageConfig.locationId) { throw new Error("Konfigurasi ID Lokasi wajib ada."); }
        // Cek CMD_RUN jika startup command membutuhkannya
        if (serverData.startup && serverData.startup.includes('${CMD_RUN}') && !serverData.environment.CMD_RUN) {
             console.warn("Peringatan: Startup command menggunakan ${CMD_RUN} tapi tidak didefinisikan di environment.");
             // throw new Error("Konfigurasi paket harus menyertakan environment.CMD_RUN"); // Aktifkan jika wajib
        }
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

// Fungsi generateStrongRandomPassword tidak dipakai lagi

module.exports = {
    createNewPteroUserForServer, // Ganti nama fungsi yang di-export
    getEggDetails,
    createNewServer,
    sendServerCommand
};
