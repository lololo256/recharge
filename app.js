// ReCharge Premium — Main Application Script (Firebase Compat SDK)

// 🌟 ReCharge Premium — Main Application Script
// แยกซอร์สโค้ดจากไฟล์ RE1.3.html เพื่อจัดโครงสร้างให้เป็นระเบียบ


const firebaseConfig = {
    apiKey: "AIzaSyDsiZf_nHuDjXm5_lvFbjIPq8akOZfiRQ0",
    authDomain: "recharge-app-77aa8.firebaseapp.com",
    databaseURL: "https://recharge-app-77aa8-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "recharge-app-77aa8",
    storageBucket: "recharge-app-77aa8.firebasestorage.app",
    messagingSenderId: "118119985392",
    appId: "1:118119985392:web:67e19911cdf7cb9d8e5235"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

let chartCpu, chartRam, chartWatt, chartNet, chartTemp;
let offlineTimer = null;

let remoteControlsEnabled = false;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function makeCommand(cmd, ttlMs = 30000) {
    const now = Date.now();
    const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
        `${now}-${Math.random().toString(36).slice(2)}`;
    return { cmd, id, created_at: now, expires_at: now + ttlMs };
}

function setRemoteControlsEnabled(enabled) {
    remoteControlsEnabled = !!enabled;
    document.querySelectorAll('[data-remote-control]').forEach((el) => {
        el.disabled = !remoteControlsEnabled;
        el.setAttribute('aria-disabled', String(!remoteControlsEnabled));
        el.classList.toggle('remote-disabled', !remoteControlsEnabled);
    });
}

function isRemoteControlReady() {
    if (!remoteControlsEnabled) {
        showToast('⚠️ คอมพิวเตอร์ออฟไลน์ — ไม่ส่งคำสั่งเพื่อป้องกันคำสั่งค้าง', 'error');
        return false;
    }
    return true;
}

function openDatePicker(id) {
    const input = document.getElementById(id);
    if (!input) return;
    try {
        if (typeof input.showPicker === 'function') input.showPicker();
        else { input.focus(); input.click(); }
    } catch (_) {
        input.focus();
        input.click();
    }
}

// =====================================================
// ฟังก์ชันสำหรับคำนวณและแสดงผลกราฟิกแบบวงแหวนคู่
// =====================================================
function triggerPulse(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active-pulse');
    setTimeout(() => el.classList.remove('active-pulse'), 400);
}

function updateDualRing(elementClass, radius, value, isTemp = false) {
    const circle = document.querySelector(`.${elementClass}`);
    if (!circle) return;

    const circumference = 2 * Math.PI * radius;

    // ป้องกันข้อผิดพลาดกรณีค่าเกิน 100 องศาเซลเซียส
    let percent = value > 100 ? 100 : value;

    const offset = circumference - (percent / 100) * circumference;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
}

// =====================================================
// ระบบกล่องข้อความโต้ตอบ (Custom Modal)
// =====================================================
function showConfirm({ icon = '❓', title, body, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก',
    danger = false, onConfirm, onCancel }) {
    const overlay = document.getElementById('custom-modal-overlay');
    document.getElementById('modal-icon').innerText = icon;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = body;
    const btns = document.getElementById('modal-btns');
    btns.innerHTML = '';
    if (cancelText) {
        const btnC = document.createElement('button');
        btnC.className = 'btn-modal-cancel';
        btnC.innerText = cancelText;
        btnC.onclick = () => { closeModal(); if (onCancel) onCancel(); };
        btns.appendChild(btnC);
    }
    const btnOk = document.createElement('button');
    btnOk.className = danger ? 'btn-modal-danger' : 'btn-modal-confirm';
    btnOk.innerText = confirmText;
    btnOk.onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
    btns.appendChild(btnOk);
    overlay.classList.add('show');
}

function showAlert({ icon = 'ℹ️', title, body, btnText = 'รับทราบ', color = 'var(--primary)', onClose }) {
    const overlay = document.getElementById('custom-modal-overlay');
    document.getElementById('modal-icon').innerText = icon;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = body;
    const btns = document.getElementById('modal-btns');
    btns.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'btn-modal-only';
    btn.style.background = color;
    btn.style.color = color === 'var(--primary)' ? '#1e212b' : 'white';
    btn.innerText = btnText;
    btn.onclick = () => { closeModal(); if (onClose) onClose(); };
    btns.appendChild(btn);
    overlay.classList.add('show');
}

window.showAlertModal = showAlert;

function closeModal() {
    document.getElementById('custom-modal-overlay').classList.remove('show');
}

// ปิดกล่องข้อความเมื่อตอบสนองกับพื้นที่หลัง
document.getElementById('custom-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'custom-modal-overlay') closeModal();
});

function showToast(msg, type = 'success') {
    const t = document.getElementById('app-toast');
    t.innerText = msg;
    t.className = `show ${type}`;
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.className = '', 3000);
}

window.switchTab = (tabId, element) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    element.classList.add('active');
};

window.sendPCCommand = (cmd) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isRemoteControlReady()) return;

    if (cmd === 'reset_uid') {
        showConfirm({
            icon: '⚠️',
            title: 'รีเซ็ต UID ?',
            body: 'ระบบคอมพิวเตอร์จะดำเนินการดังต่อไปนี้:<br><br>' +
                '&nbsp;&nbsp;1. ลบ UID เดิมออก<br>' +
                '&nbsp;&nbsp;2. ปิดกระบวนการอัตโนมัติ<br><br>' +
                '<span style="color:#f1c40f;">📌</span> หลังจากนั้น โปรดดำเนินการ<br>' +
                '<b>"เปิดแอปพลิเคชันเพื่อดำเนินการ ReCharge"</b><br>เพื่อระบุ UID ล่าสุดลงในอินเทอร์เฟซผู้ใช้',
            confirmText: 'ยืนยันการรีเซ็ต', cancelText: 'ยกเลิก', danger: true,
            onConfirm: async () => {
                try {
                    await db.ref(`users/${uid}/PC_Control/command`).set(makeCommand('reset_uid'));
                    showResetUidBanner();
                } catch (err) {
                    console.error(err);
                    showToast('❌ ส่งคำสั่งรีเซ็ต UID ไม่สำเร็จ', 'error');
                }
            }
        });
        return;
    }

    const cmdLabels = {
        shutdown: { icon: '🔴', label: 'ปิดเครื่อง', danger: true },
        restart: { icon: '🔄', label: 'รีสตาร์ท', danger: false },
        sleep: { icon: '🌙', label: 'สลีป', danger: false },
        lock: { icon: '🔒', label: 'ล็อคหน้าจอ', danger: false },
    };
    const info = cmdLabels[cmd] || { icon: '⚙️', label: cmd, danger: false };
    showConfirm({
        icon: info.icon, title: `สั่ง ${info.label} ?`,
        body: `ยืนยันการดำเนินการ <b>${escapeHtml(info.label)}</b> คอมพิวเตอร์เลยไหมครับ?`,
        confirmText: `สั่ง ${info.label}`, danger: info.danger,
        onConfirm: async () => {
            try {
                await db.ref(`users/${uid}/PC_Control/command`).set(makeCommand(cmd));
                showToast(`✅ ส่งคำสั่ง ${info.label} แล้ว!`);
            } catch (err) {
                console.error(err);
                showToast(`❌ ส่งคำสั่ง ${info.label} ไม่สำเร็จ`, 'error');
            }
        }
    });
};

function showResetUidBanner() {
    const old = document.getElementById('reset-uid-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'reset-uid-banner';
    banner.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.85);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        padding: 20px; backdrop-filter: blur(6px);
    `;
    banner.innerHTML = `
        <div style="background: #1e212b; border: 2px solid #9b59b6; border-radius: 24px;
                    padding: 32px 28px; max-width: 380px; width: 100%; text-align: center;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.6);">
            <div style="font-size: 52px; margin-bottom: 12px;">🔄</div>
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">รีเซ็ต UID สำเร็จ!</div>
            <div style="font-size: 13px; color: #a4b0be; line-height: 1.7; margin-bottom: 24px;">
                อุปกรณ์ต้นทางปิดระบบอัตโนมัติเรียบร้อยแล้ว<br>
                <span style="color: #f5f6fa; font-weight: 600;">โปรดดำเนินการใช้งานบนคอมพิวเตอร์</span><br>
                แล้ว <span style="color: #9b59b6; font-weight: 700;">เปิดไฟล์โปรแกรม recharge_sender.exe เพื่อตั้งกระบวนการติดตั้งเบื้องหน้าใหม่</span><br>
                เพื่อระบุ UID ล่าสุดลงในอินเทอร์เฟซผู้ใช้
            </div>
            <div style="background: rgba(155,89,182,0.15); border: 1px solid rgba(155,89,182,0.4);
                        border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #a4b0be;
                        margin-bottom: 24px; text-align: left;">
                <div style="font-weight: 700; color: #9b59b6; margin-bottom: 6px;">📋 ขั้นตอน:</div>
                <div>1️⃣ ไปที่เครื่องคอมพิวเตอร์ → ค้นหาไฟล์ <b>recharge_sender.exe</b></div>
                <div>2️⃣ เปิดแอปพลิเคชันเพื่อดำเนินการ</div>
                <div>3️⃣ กรอกรหัส UID ที่แสดงบนแอปพลิเคชัน</div>
                <div>4️⃣ กดตกลง (OK) → ระบบจะทำการเชื่อมโยงอัตโนมัติ</div>
            </div>
            <button onclick="document.getElementById('reset-uid-banner').remove()"
                    style="background: #9b59b6; color: white; border: none; border-radius: 12px;
                           padding: 14px 30px; font-size: 15px; font-weight: 700;
                           font-family: 'Prompt'; cursor: pointer; width: 100%;">
                รับทราบ
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

window.sendBoardCommand = (cmd) => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isRemoteControlReady()) return;
    showConfirm({
        icon: '📡',
        title: 'รีเซ็ต WiFi บอร์ด ESP32 ?',
        body: 'บอร์ดไมโครคอนโทรลเลอร์จะเข้าระบบเริ่มต้นเครื่องเพื่อกำหนดค่า WiFi อีกรอบ<br><span style="color:var(--red);">⚠️ สถานการณ์เชื่อมต่อบอร์ดจะยุติการรอเป็นรูปแบบออฟไลน์ชั่วขณะหนึ่ง</span>',
        confirmText: 'ดำเนินการรีเซ็ตอุปกรณ์ฮาร์ดแวร์',
        danger: true,
        onConfirm: () => {
            db.ref(`users/${uid}/PC_Monitor/Board_Command`).set(cmd).then(() => {
                showToast('📡 บอร์ดฮาร์ดแวร์กำลังเข้าสู่ขั้นตอนการเริ่มต้นใหม่!');
            }).catch((err) => {
                console.error(err); showToast('❌ ส่งคำสั่งบอร์ดไม่สำเร็จ', 'error');
            });
        }
    });
};

window.saveHardwareSetup = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const setupData = {
        fan_count: Math.max(0, parseInt(document.getElementById('setup-fan').value, 10) || 0),
        hdd_count: Math.max(0, parseInt(document.getElementById('setup-hdd').value, 10) || 0),
        ssd_count: Math.max(0, parseInt(document.getElementById('setup-ssd').value, 10) || 0),
        has_aio: document.getElementById('setup-aio').classList.contains('active'),
        unit_price: Math.max(0, parseFloat(document.getElementById('setup-unit-price').value) || 4.5)
    };
    db.ref(`users/${uid}/Settings`).update(setupData).then(() => showToast('✅ บันทึกสเปคและเรทค่าไฟเรียบร้อย!')).catch((err) => { console.error(err); showToast('❌ บันทึกการตั้งค่าไม่สำเร็จ', 'error'); });
};

window.saveOnboarding = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const isAio = parseInt(document.getElementById('onboard-aio').value) === 1;
    const settingsData = {
        unit_price: Math.max(0, parseFloat(document.getElementById('onboard-unit-price').value) || 4.5),
        fan_count: Math.max(0, parseInt(document.getElementById('onboard-fan').value, 10) || 0),
        hdd_count: Math.max(0, parseInt(document.getElementById('onboard-hdd').value, 10) || 0),
        ssd_count: Math.max(0, parseInt(document.getElementById('onboard-ssd').value, 10) || 0),
        has_aio: isAio
    };
    db.ref(`users/${uid}/Settings`).update(settingsData).then(() => {
        document.getElementById('onboarding-overlay').classList.remove('show');
        showToast('✅ ตั้งค่าเริ่มต้นสำเร็จ เริ่มใช้งานได้เลย!');
    }).catch((err) => { console.error(err); showToast('❌ บันทึกการตั้งค่าเริ่มต้นไม่สำเร็จ', 'error'); });
};


document.getElementById('loginBtn').onclick = () => auth.signInWithPopup(provider);
document.getElementById('logoutBtn').onclick = () => auth.signOut().then(() => window.location.reload());

auth.onAuthStateChanged((user) => {
    if (user) {
        setRemoteControlsEnabled(false);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('bottom-nav').style.display = 'flex';

        document.getElementById('uid-display').innerText = "UID: " + user.uid;
        document.getElementById('uid-display').classList.remove('skeleton-loader');

        const copyBtn = document.getElementById('copyUidBtn');
        copyBtn.style.display = 'flex';
        copyBtn.onclick = () => {
            const fallbackCopy = () => {
                const ta = document.createElement("textarea");
                ta.value = user.uid;
                ta.style.position = "fixed"; 
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {
                    document.execCommand('copy');
                    return true;
                } catch (err) {
                    return false;
                } finally {
                    document.body.removeChild(ta);
                }
            };

            const onSuccess = () => {
                copyBtn.innerHTML = "<span class='material-symbols-rounded' style='font-size: 14px;'>check_circle</span> คัดลอกแล้ว";
                copyBtn.style.background = "var(--primary)";
                copyBtn.style.color = "#1e212b";
                setTimeout(() => {
                    copyBtn.innerHTML = "<span class='material-symbols-rounded' style='font-size: 14px;'>content_copy</span> คัดลอก";
                    copyBtn.style.background = "transparent";
                    copyBtn.style.color = "var(--primary)";
                }, 2000);
            };

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(user.uid).then(onSuccess).catch(err => {
                    if (fallbackCopy()) onSuccess();
                    else showToast('⚠️ กรุณาคลุมดำ UID แล้วคัดลอกเองครับ', 'error');
                });
            } else {
                // การแก้ไขข้อผิดพลาด (Bug Fix): เบราว์เซอร์ Android บล็อก API ใน HTTP ทั่วไป เปลี่ยนมาใช้ Textarea แทน 
                if (fallbackCopy()) onSuccess();
                else showToast('⚠️ เบราว์เซอร์ของคุณไม่รองรับการคัดลอกอัตโนมัติ', 'error');
            }
        };

        let unitPrice = 4.5;
        let globalSessions = null;

        // Check if Settings node exists for onboarding
        db.ref(`users/${user.uid}/Settings`).once('value', (snap) => {
            if (!snap.exists()) {
                document.getElementById('onboarding-overlay').classList.add('show');
                // Notify via bell that data is missing
                db.ref(`users/${user.uid}/alerts/missing_data`).set({
                    msg: "กรุณาตั้งค่าเริ่มต้นและสเปคคอมพิวเตอร์เพื่อเปิดใช้งานการคำนวณค่าไฟ",
                    time: new Date().toLocaleTimeString()
                });
            }
        });

        // Listen for Settings changes (replaces pc_setup)
        db.ref(`users/${user.uid}/Settings`).on('value', (snap) => {
            const setup = snap.val();
            if (setup) {
                document.getElementById('setup-fan').value = setup.fan_count || 0;
                document.getElementById('setup-hdd').value = setup.hdd_count || 0;
                document.getElementById('setup-ssd').value = setup.ssd_count || 0;
                if (setup.has_aio) document.getElementById('setup-aio').classList.add('active');
                else document.getElementById('setup-aio').classList.remove('active');

                if (setup.unit_price) {
                    unitPrice = setup.unit_price;
                    document.getElementById('setup-unit-price').value = unitPrice;
                }
            }
        });


        // =====================================================
        // ตรวจสอบสถานะเครือข่ายทันทีเมื่อเริ่มต้นการโหลดแอปพลิเคชัน
        // =====================================================
        let _isFirstMonitorLoad = true;

        function setOfflineUI(msg) {
            document.getElementById('status-text').innerText = msg || "• สถานะ: ไม่ตอบสนอง (มีการยุติการเชื่อมต่อ หรือระบบต้นทางกำลังหยุดทำงาน)";
            document.getElementById('status-text').style.color = "var(--red)";
            document.getElementById('status-dot').style.background = "var(--red)";
            document.getElementById('status-dot').style.boxShadow = "0 0 10px var(--red)";
            const tabHome = document.getElementById('tab-home');
            if (tabHome) tabHome.classList.add('offline-mode');
            setRemoteControlsEnabled(false);
        }

        function setOnlineUI() {
            document.getElementById('status-text').innerText = "• สถานะ: การเชื่อมต่อระบบสมบูรณ์และเสถียร";
            document.getElementById('status-text').style.color = "var(--primary)";
            document.getElementById('status-dot').style.background = "var(--primary)";
            document.getElementById('status-dot').style.boxShadow = "0 0 10px var(--primary)";
            const tabHome = document.getElementById('tab-home');
            if (tabHome) tabHome.classList.remove('offline-mode');
            setRemoteControlsEnabled(true);
        }

        // ดำเนินการตรวจสอบสถานะทันทีในครั้งแรก (ไม่ต้องรอ 15 วินาที)
        db.ref(`users/${user.uid}/PC_Monitor`).once('value').then((snap) => {
            const d = snap.val();
            if (!d) {
                setOfflineUI("• สถานะ: ยังไร้การเชื่อมต่อ — โปรดเปิดไฟล์ .exe เพื่อสั่งระบบก่อนเริ่มทำงาน");
                return;
            }
            if (d.online === false) {
                setOfflineUI("• สถานะ: โปรแกรมหยุดทำงาน — โปรดดำเนินโปรแกรมใหม่อีกครั้ง");
                return;
            }
            // ตรวจสอบระยะเวลาของข้อมูลล่าสุด (ถ้าเกิน 15 วินาทีระบบจะถือว่าออฟไลน์)
            if (d.updated) {
                const lastUpdate = new Date(d.updated).getTime();
                const now = Date.now();
                const ageSeconds = (now - lastUpdate) / 1000;
                if (ageSeconds > 15) {
                    setOfflineUI("• สถานะ: ไม่ตอบสนอง (มีการยุติการเชื่อมต่อ หรือระบบต้นทางกำลังหยุดทำงาน)");
                    return;
                }
            }
            // ข้อมูลล่าสุด → ออนไลน์
            setOnlineUI();
        });

        db.ref(`users/${user.uid}/PC_Monitor`).on('value', (snap) => {
            const d = snap.val();

            if (d) {
                // ตรวจสถานะออนไลน์เท่านั้น (เมื่อได้รับสถานะจาก Python)
                if (d.online === false) {
                    clearTimeout(offlineTimer);
                    setOfflineUI("• สถานะ: โปรแกรมหยุดทำงาน — โปรดดำเนินโปรแกรมใหม่อีกครั้ง");
                    return;
                }

                clearTimeout(offlineTimer);
                setOnlineUI();

                let cpu_usage = Number(d.CPU || 0);
                let cpu_temp = Number(d.CPU_Temp || 0);
                let cpu_temp_source = d.CPU_Temp_Source || d.cpu_temp_source || 'unknown';
                let gpu_usage = Number(d.GPU || 0);
                let gpu_temp = Number(d.GPU_Temp || 0);
                let gpu_sensor_available = d.GPU_Sensor_Available !== false && d.gpu_sensor_available !== false;

                // โครงสร้างคำสั่งเดิม
                let ram_usage = d.RAM || 0;

                // 🌟 Update Hero Widgets (Radii 42 for outer, 28 for inner)
                if (document.getElementById('val-cpu').innerText != cpu_usage) {
                    document.getElementById('val-cpu').innerText = cpu_usage;
                    triggerPulse('val-cpu');
                }
                updateDualRing('cpu-usage-ring', 42, cpu_usage);
                updateDualRing('cpu-temp-ring', 28, cpu_temp, true);

                if (document.getElementById('val-gpu').innerText != gpu_usage) {
                    document.getElementById('val-gpu').innerText = gpu_sensor_available ? gpu_usage : '–';
                    triggerPulse('val-gpu');
                }
                updateDualRing('gpu-usage-ring', 42, gpu_usage);
                updateDualRing('gpu-temp-ring', 28, gpu_temp, true);

                if (document.getElementById('val-ram').innerText != ram_usage) {
                    document.getElementById('val-ram').innerText = ram_usage;
                    triggerPulse('val-ram');
                }
                updateDualRing('ram-usage-ring', 42, ram_usage);

                // 🌟 [New] Update Interactive Tooltips
                document.getElementById('tooltip-cpu').innerText = `ภาระงาน: ${cpu_usage}% | อุณหภูมิ: ${cpu_temp}°C${cpu_temp_source === 'sensor' ? '' : ' (ประมาณ)'}`;
                document.getElementById('tooltip-gpu').innerText = gpu_sensor_available ? `ภาระงาน: ${gpu_usage}% | อุณหภูมิ: ${gpu_temp}°C` : 'ไม่พบ GPU sensor ที่รองรับ (เช่น NVIDIA)';
                if (document.getElementById('tooltip-ram')) {
                    document.getElementById('tooltip-ram').innerText = `ใช้ไป: ${ram_usage}%`;
                }

                const wattNow = Math.round(d.Watt || 0);
                document.getElementById('val-watt').innerText = wattNow + "W";
                document.getElementById('hw-avg-watt').innerText = `ตอนนี้ ${wattNow} W`;
                document.getElementById('bar-watt').style.width = Math.min((wattNow / 500) * 100, 100) + "%";

                let cpuTemp = d.CPU_Temp || 0;
                document.getElementById('val-cpu-temp').innerText = cpuTemp + "°C" + (cpu_temp_source === 'sensor' ? '' : ' ≈');
                document.getElementById('bar-cpu-temp').style.width = cpuTemp + "%";
                document.getElementById('bar-cpu-temp').style.background = cpuTemp > 80 ? "var(--red)" : "var(--primary)";

                document.getElementById('val-dl').innerText = (d.Net_DL_Mbps || 0).toFixed(2);
                document.getElementById('val-ul').innerText = (d.Net_UL_Mbps || 0).toFixed(2);
                
                // Storage Bar Update (Real-time from OS)
                document.getElementById('val-storage').innerText = (d.Storage_C_Free_GB || 0).toFixed(1);
                document.getElementById('bar-storage').style.width = (d.Storage_C_Percent || 50) + "%";


                // แสดงผลการวิเคราะห์พลังงานด้วยระบบปัญญาประดิษฐ์ (AI Energy Insight)
                const insightBanner = document.getElementById('insight-banner');
                const insightText = document.getElementById('insight-text');

                if (d.insight_wasted_baht > 0.5) {
                    insightBanner.style.display = 'flex';
                    insightText.innerHTML = `การจำแนกสถานะบ่งชี้การปล่อยเครื่องยนต์เปิดทิ้งไว้ <b>${(Number(d.insight_idle_mins || 0) / 60).toFixed(1)} ชม.</b><br>ก่อให้เกิดการใช้จ่ายกระแสไฟฟ้าโดยเปล่าประโยชน์ <b style="color:var(--red);">฿${Number(d.insight_wasted_baht || 0).toFixed(2)}</b><br><span style="color:var(--text-sub); font-size:11px;">📌 ข้อแนะนำ: หากยุติรอบการใช้ในตอนนี้ โปรดสั่งเปิดโหมดจำศีลระบบด้วย Sleep หรือสั่งปิดเครื่องเด็ดขาดเพื่อบรรลุวัตถุประสงค์สถิติประหยัดต้นทุนพลังงานไฟฟ้า</span>`;
                } else {
                    insightBanner.style.display = 'none';
                }

                // แสดงสถานะแบตเตอรี่ (ในกรณีที่ระบบมีข้อมูล)
                const batPct = d.Battery_Percent;
                const batCard = document.getElementById('battery-card');
                if (batPct != null && batPct !== undefined) {
                    batCard.style.display = 'block';
                    document.getElementById('val-battery').innerText = batPct + '%';
                    
                    let batStatus = d.Is_Plugged ? '🔌 กำลังชาร์จ' : '🔋 ใช้แบตเตอรี่';
                    if (batPct >= 100 && d.Is_Plugged) batStatus = '🔌 เสียบปลั๊กอยู่ (เต็ม)';
                    
                    document.getElementById('hw-battery-status').innerText = batStatus;
                    document.getElementById('hw-battery-status').classList.remove('skeleton-loader');
                    
                    const bar = document.getElementById('bar-battery');
                    bar.style.width = batPct + '%';
                    bar.style.background = batPct < 20 ? 'var(--red)' : batPct < 50 ? 'var(--yellow)' : 'var(--primary)';
                } else {
                    if (batCard) batCard.style.display = 'none';
                }

                // อัปเดตข้อมูลเวลาที่เหลือนับถอยหลัง
                if (d.Timer_Left_Secs != null && d.Timer_Left_Secs > 0) {
                    document.getElementById('timer-display').style.display = 'block';
                    let totalMins = Math.floor(d.Timer_Left_Secs / 60);
                    let s = Math.floor(d.Timer_Left_Secs % 60); // การแก้ไขข้อผิดพลาด (Bug Fix) #7: ใช้ฟังก์ชัน Math.floor ป้องกันทศนิยม
                    let h = Math.floor(totalMins / 60);
                    let m = totalMins % 60;
                    
                    // การแก้ไขข้อผิดพลาด (Bug Fix): ปรับปรุงการแสดงผลหน่วยชั่วโมงเป็นรูปแบบ (HH:MM:SS)
                    if (h > 0) {
                        document.getElementById('timer-countdown').innerText =
                            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    } else {
                        document.getElementById('timer-countdown').innerText =
                            `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    }
                } else {
                    document.getElementById('timer-display').style.display = 'none';
                }
                
                // การแก้ไขข้อผิดพลาด (Bug Fix): แสดงยอดสะสมรายวันตามเวลาจริงผ่านระบบ Monitor
                if (window.heroState.today === 'live') {
                    if (d.Daily_Cost_THB !== undefined) {
                        const elCost = document.getElementById('costTodayVal');
                        if(elCost) elCost.innerText = d.Daily_Cost_THB.toFixed(2);
                    }
                    if (d.Daily_Mins !== undefined) {
                        const elTime = document.getElementById('timeTodayVal');
                        if(elTime) {
                            const h = Math.floor(d.Daily_Mins / 60);
                            const m = Math.floor(d.Daily_Mins % 60);
                            elTime.innerText = h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
                        }
                    }
                }

                if (d.Top_Apps && d.Top_Apps.length > 0) {
                    let appsHtml = "";
                    d.Top_Apps.forEach(app => {
                        // การแก้ไขข้อผิดพลาด (Bug Fix) #10: ดำเนินการหนีอักขระ (Escape) สำหรับชื่อแอปพลิเคชันเพื่อป้องกันการโจมตีแบบ XSS
                        const rawName = app.name || '';
                        const displayName = escapeHtml(rawName.replace(/\.exe/gi, '').replace(/_exe/gi, ''));
                        const processAttr = escapeHtml(rawName);
                        const ramNum = Number(app.ram_gb);
                        const ramText = Number.isFinite(ramNum) ? ` | <span style="font-size:11px; color:var(--text-sub);">${ramNum.toFixed(1)}GB</span>` : '';
                        appsHtml += `
                        <div class="top-app-item">
                            <div class="top-app-name"><span class="material-symbols-rounded" style="font-size:16px;">terminal</span> ${displayName}</div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="top-app-cpu">${Number(app.cpu || 0).toFixed(1)}%${ramText}</div>
                                <div style="display:flex;">
                                    <button class="kill-btn" title="Force Close ${displayName}" data-process="${processAttr}">
                                        <span class="material-symbols-rounded">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    });
                    document.getElementById('top-apps-container').innerHTML = appsHtml;
                    document.querySelectorAll('#top-apps-container .kill-btn[data-process], #top-ram-apps-container .kill-btn[data-process]').forEach(btn => {
                        btn.addEventListener('click', () => killProcess(btn.dataset.process));
                    });
                } else {
                    document.getElementById('top-apps-container').innerHTML = '<div style="font-size: 12px; color: var(--text-sub); text-align: center;">ไม่มีแอปพลิเคชันที่ใช้ CPU สูงในขณะนี้</div>';
                }

                if (d.Top_RAM_Apps && d.Top_RAM_Apps.length > 0) {
                    let ramHtml = "";
                    d.Top_RAM_Apps.forEach(app => {
                        // การแก้ไขข้อผิดพลาด (Bug Fix) #10: ดำเนินการหนีอักขระ (Escape) สำหรับชื่อแอปพลิเคชันเพื่อป้องกันการโจมตีแบบ XSS
                        const rawName = app.name || '';
                        const displayName = escapeHtml(rawName.replace(/\.exe/gi, '').replace(/_exe/gi, ''));
                        const processAttr = escapeHtml(rawName);
                        ramHtml += `
                        <div class="top-app-item">
                            <div class="top-app-name"><span class="material-symbols-rounded" style="font-size:16px;">terminal</span> ${displayName}</div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="top-app-cpu"><span style="font-size:11px; opacity:0.7">${Number(app.cpu || 0).toFixed(1)}%</span> | ${Number(app.ram_gb || 0).toFixed(1)}GB</div>
                                <div style="display:flex;">
                                    <button class="kill-btn" title="Force Close ${displayName}" data-process="${processAttr}">
                                        <span class="material-symbols-rounded">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    });
                    document.getElementById('top-ram-apps-container').innerHTML = ramHtml;
                    document.querySelectorAll('#top-apps-container .kill-btn[data-process], #top-ram-apps-container .kill-btn[data-process]').forEach(btn => {
                        btn.addEventListener('click', () => killProcess(btn.dataset.process));
                    });
                } else {
                    if (document.getElementById('top-ram-apps-container')) {
                        document.getElementById('top-ram-apps-container').innerHTML = '<div style="font-size: 12px; color: var(--text-sub); text-align: center;">ไม่มีแอปพลิเคชันที่ใช้ RAM สูงในขณะนี้</div>';
                    }
                }

                // ครั้งแรกใช้ระยะเวลา 5 วินาที | หลังจากนั้น 15 วินาทีตามค่าเริ่มต้น
                const timeoutMs = _isFirstMonitorLoad ? 5000 : 15000;
                _isFirstMonitorLoad = false;

                offlineTimer = setTimeout(() => {
                    setOfflineUI();
                }, timeoutMs);
            }
        });

        db.ref(`users/${user.uid}/hardware_info`).on('value', (snap) => {
            if (snap.val()) {
                const hw = snap.val();
                document.getElementById('hw-cpu-name').innerText = hw.cpu_model || '–';
                document.getElementById('hw-gpu-info').innerText = `GPU: ${hw.gpu_model || '–'} | จอ ${hw.monitor_count || 1} จอ`;
                document.getElementById('pc-name-display').innerText = (hw.os || 'Windows') + " PC";
                document.getElementById('hw-gpu-info').classList.remove('skeleton-loader');
                document.getElementById('pc-name-display').classList.remove('skeleton-loader');
            }
        });

        // =====================================================
        // คุณสมบัติ 1: ระบบจัดการเครื่องทางไกล — รับผลลัพธ์ (kill_result)
        // =====================================================
        window.killProcess = (processName) => {
            const uid = auth.currentUser?.uid;
            if (!uid || !isRemoteControlReady()) return;
            showConfirm({
                icon: '⚡',
                title: `Force Close ?`,
                body: `ปิด <b>"${escapeHtml(processName)}"</b> เลยไหมครับ?<br><span style="color:var(--red); font-size:12px;">โปรแกรมจะถูกปิดทันทีโดยไม่บันทึก</span>`,
                confirmText: 'Force Close',
                danger: true,
                onConfirm: () => {
                    db.ref(`users/${uid}/PC_Control/command`).set(makeCommand(`kill:${processName}`))
                        .then(() => showKillToast(`⏳ กำลังปิด ${escapeHtml(processName)}...`, 'var(--yellow)'))
                        .catch((err) => { console.error(err); showKillToast('❌ ส่งคำสั่งไม่สำเร็จ', 'var(--red)'); });
                }
            });
        };

        function showKillToast(msg, color = 'var(--primary)') {
            const t = document.getElementById('kill-toast');
            t.innerText = msg;
            t.style.borderColor = color;
            t.style.color = color;
            t.classList.add('show');
            clearTimeout(window._killToastTimer);
            window._killToastTimer = setTimeout(() => t.classList.remove('show'), 3000);
        }

        db.ref(`users/${user.uid}/PC_Control/kill_result`).on('value', (snap) => {
            const r = snap.val();
            if (!r || !r.status) return;
            if (r.status === 'killed') {
                showKillToast(`✅ ปิด "${r.target}" สำเร็จแล้ว!`, 'var(--primary)');
            } else {
                showKillToast(`❌ ปิด "${r.target}" ไม่สำเร็จ`, 'var(--red)');
            }
        });

        // =====================================================
        // คุณสมบัติ 2: โหมดเกมเพลย์ — ติดตามสถานะของโหมดเกม
        // =====================================================
        let _lastGameEndKey = '';  // การแก้ไขข้อผิดพลาด (Bug Fix): ป้องกันระบบแสดงการแจ้งเตือนซ้ำ
        let _isGamingNotified = false; // ป้องกันการแจ้งเตือนเริ่มต้นเกมซ้อนทับในรอบการทำงานเดียวกัน
        let _isFirstGamingLoad = true; // แก้ปัญหาแจ้งเตือนรัวเมื่อรีเฟรชหน้าต่างใหม่

        db.ref(`users/${user.uid}/gaming_mode`).on('value', (snap) => {
            const g = snap.val();
            const banner = document.getElementById('gaming-banner');
            const wattEl = document.getElementById('gaming-watt');

            if (g && g.active) {
                document.body.classList.add('gaming-active');
                banner.classList.add('active');
                document.getElementById('gaming-game-name').innerText = (g.game || 'Unknown Game').replace(/\.exe/gi, '').replace(/_exe/gi, '');
                
                let tM = g.session_mins || 0;
                document.getElementById('gaming-mins').innerText = `${Math.floor(tM / 60)}.${Math.floor(tM % 60).toString().padStart(2, '0')}`;
                document.getElementById('gaming-cost').innerText = g.cost_thb != null ? Number(g.cost_thb).toFixed(2) : '0.00';
                
                const wattNow = document.getElementById('val-watt').innerText;
                if (wattEl) wattEl.innerText = wattNow;

                // เพิ่มระบบแจ้งเตือนเข้ากล่องข้อความ (เฉพาะประเดิมการทำงาน)
                if (!_isGamingNotified) {
                    _isGamingNotified = true;
                    if (window.addNotification && !_isFirstGamingLoad) {
                        const cleanGameName = (g.game || '').replace(/\.exe/gi, '').replace(/_exe/gi, '');
                        window.addNotification("sports_esports", `เข้าสู่โหมดเกม: ${cleanGameName}`, "ระบบกำลังติดตามการใช้พลังงานแบบเข้มข้น...", "var(--red)");
                    }
                }
                _lastGameEndKey = '';  
            } else {
                document.body.classList.remove('gaming-active');
                banner.classList.remove('active');
                _isGamingNotified = false; // รีเซ็ตค่าเพื่อเตรียมแสดงรอบถัดไป

                // แจ้งเตือนสถิติลงกล่องข้อความ
                if (g && !g.active && g.last_game) {
                    const endKey = `${g.last_game}_${g.last_mins}`;
                    if (endKey !== _lastGameEndKey) {
                        _lastGameEndKey = endKey;
                        // แก้ไข: ย้ายการแจ้งเตือนไปไว้ในกล่องข้อความ
                        if (window.addNotification && !_isFirstGamingLoad) {
                            const cleanLastGame = (g.last_game || '').replace(/\.exe/gi, '').replace(/_exe/gi, '');
                            window.addNotification(
                                "flag", `จบเกม: ${cleanLastGame}`, 
                                `ใช้เวลา ${g.last_mins} นาที — ค่าไฟ ฿${Number(g.last_cost_thb || 0).toFixed(2)}`, 
                                "var(--yellow)"
                            );
                        }
                    }
                }
            }
            _isFirstGamingLoad = false;
        });

        // =====================================================
        // คุณสมบัติ 3: การแจ้งเตือนอัจฉริยะ — แสดงกล่องข้อความเมื่อระบบ Python ส่งข้อมูลเตือน
        // =====================================================
        let _lastAlertCpuTime = '', _lastAlertCostTime = '';

        function showAlertToast(type, icon, title, body) {
            const container = document.getElementById('alert-container');
            if (!container) return;
            const div = document.createElement('div');
            div.className = `alert-toast ${type === 'cpu' ? 'cpu' : 'cost'}`;
            div.innerHTML = `
                <div class="alert-toast-icon"></div>
                <div style="flex:1;">
                    <div class="alert-toast-title" style="color:${type === 'cpu' ? 'var(--red)' : 'var(--yellow)'};"></div>
                    <div class="alert-toast-body"></div>
                </div>
                <button class="alert-close" aria-label="ปิด">✕</button>`;
            div.querySelector('.alert-toast-icon').textContent = icon;
            div.querySelector('.alert-toast-title').textContent = title;
            div.querySelector('.alert-toast-body').textContent = body;
            div.querySelector('.alert-close').addEventListener('click', () => div.remove());
            container.prepend(div);
            setTimeout(() => div.remove(), 12000);
        }

        db.ref(`users/${user.uid}/alerts/cpu_temp`).on('value', (snap) => {
            const a = snap.val();
            if (!a || !a.time) return;
            if (a.time === _lastAlertCpuTime) return;
            _lastAlertCpuTime = a.time;
            showAlertToast('cpu', '🔥',
                `CPU ร้อนจัด! ${a.value}°C`,
                `เกินขีด ${a.threshold}°C — ตรวจพัดลม/thermal paste ด่วน!\nเวลา ${a.time}`
            );
        });

        db.ref(`users/${user.uid}/alerts/daily_cost`).on('value', (snap) => {
            const a = snap.val();
            if (!a || !a.time) return;
            if (a.time === _lastAlertCostTime) return;
            _lastAlertCostTime = a.time;
            showAlertToast('cost', '💸',
                `ค่าไฟวันนี้ ฿${a.value} — เกินเป้าแล้ว!`,
                `เป้าที่ตั้งไว้: ฿${a.threshold} — ลองปิดโปรแกรมหนักๆ ดูครับ\nเวลา ${a.time}`
            );
        });

        // =====================================================
        // ระบบจัดหมวดหมู่เกมอัจฉริยะด้วยปัญญาประดิษฐ์ — แจ้งเตือนลงกล่องข้อความ
        // =====================================================
        let lastSuspect = null;
        let _isFirstSuspectLoad = true;
        db.ref(`users/${user.uid}/gaming_mode/suspect`).on('value', (snap) => {
            const suspect = snap.val();
            if (!suspect || !suspect.name) {
                lastSuspect = null;
                _isFirstSuspectLoad = false;
                return;
            }
            if (lastSuspect === suspect.name) {
                _isFirstSuspectLoad = false;
                return;
            }

            // แจ้งให้ระบบตรวจสอบเงื่อนไขสถานะเกม
            if (document.body.classList.contains('gaming-active')) {
                _isFirstSuspectLoad = false;
                return;
            }
            lastSuspect = suspect.name;

            // บันทึกแจ้งเตือนโดยไม่รบกวนผู้ใช้ (ให้ผู้ใช้อนุมัติภายหลัง)
            if (!_isFirstSuspectLoad) {
                window.addSuspectNotification(user.uid, {
                    name: suspect.name,
                    cpu_pct: suspect.cpu_pct,
                    ram_gb: suspect.ram_gb,
                    detected_at: suspect.detected_at
                });
            }
            _isFirstSuspectLoad = false;
        });

        // ระบบเรียกดูข้อมูลประวัติย้อนหลัง (Time Machine)
        let historyUnsubscribe = null;

        function fetchHistoryByDate(dateStr) {
            if (historyUnsubscribe) historyUnsubscribe();

            const startOfDay = dateStr + " 00:00:00";
            const endOfDay = dateStr + " 23:59:59";

            const historyQuery = db.ref(`users/${user.uid}/history_logs`).orderByChild("timestamp").startAt(startOfDay).endAt(endOfDay);

            // 🐛 BUG FIX: เลิกใช้ .on('value') เพื่อแก้ Memory Leak เวลาเปลี่ยนวันที่ไปมา 
            // ให้ดึงแค่ .once('value') ครั้งเดียวพอเพราะเป็นข้อมูลอดีตที่ไม่ได้เปลี่ยนแล้ว
            historyQuery.once('value').then((snap) => {
                const logs = snap.val();
                if (logs) {
                    let labels = [], cpu = [], gpu = [], ram = [], watt = [], netDl = [], netUl = [], cpuTemp = [], gpuTemp = [];
                    let sumCpu = 0, sumGpu = 0, sumRam = 0, count = 0;
                    let appUsage = {};

                    Object.values(logs).forEach(log => {
                        labels.push(log.timestamp.split(' ')[1].substring(0, 5));
                        cpu.push(log.cpu); gpu.push(log.gpu); ram.push(log.ram);
                        watt.push(log.watt || 0);
                        cpuTemp.push(log.cpu_temp || 0);
                        gpuTemp.push(log.gpu_temp || 0);
                        netDl.push(log.net_dl || 0); netUl.push(log.net_ul || 0);
                        sumCpu += log.cpu; sumGpu += log.gpu; sumRam += log.ram; count++;

                        if (log.top_apps) {
                            log.top_apps.forEach(app => {
                                if (!appUsage[app.name]) appUsage[app.name] = { count: 0, total_cpu: 0, total_ram: 0 };
                                appUsage[app.name].count += 1;
                                appUsage[app.name].total_cpu += app.cpu;
                                if (app.ram_gb) appUsage[app.name].total_ram += app.ram_gb;
                            });
                        }
                    });

                    document.getElementById('avg-cpu').innerText = Math.round(sumCpu / count) + "%";
                    document.getElementById('avg-gpu').innerText = Math.round(sumGpu / count) + "%";
                    document.getElementById('avg-ram').innerText = Math.round(sumRam / count) + "%";

                    updateCharts(labels, cpu, gpu, ram, watt, netDl, netUl, cpuTemp, gpuTemp);

                    let sortedApps = Object.keys(appUsage).map(name => {
                        return {
                            name: name,
                            avg_cpu: (appUsage[name].total_cpu / appUsage[name].count).toFixed(1),
                            avg_ram: (appUsage[name].total_ram / appUsage[name].count).toFixed(1),
                            score: appUsage[name].total_cpu
                        };
                    }).sort((a, b) => b.score - a.score).slice(0, 5);

                    let appsHtml = "";
                    sortedApps.forEach(app => {
                        const ramDisplay = app.avg_ram > 0 ? ` | <span style="font-size:11px; opacity:0.8;">${app.avg_ram}GB</span>` : '';
                        appsHtml += `
                        <div class="top-app-item">
                            <div class="top-app-name"><span class="material-symbols-rounded" style="font-size:16px;">apps</span> ${escapeHtml((app.name || '').replace(/\.exe/gi, '').replace(/_exe/gi, ''))}</div>
                            <div class="top-app-cpu">รันเฉลี่ย ${app.avg_cpu}%${ramDisplay}</div>
                        </div>`;
                    });
                    document.getElementById('history-apps-container').innerHTML = appsHtml;
                } else {
                    document.getElementById('avg-cpu').innerText = "0%";
                    document.getElementById('avg-gpu').innerText = "0%";
                    document.getElementById('avg-ram').innerText = "0%";
                    document.getElementById('history-apps-container').innerHTML = '<div style="font-size: 12px; color: var(--text-sub); text-align: center;">ไม่มีการบันทึกประวัติในวันที่เลือก</div>';
                    updateCharts([], [], [], [], [], [], [], [], []);
                }
            }); // ปรับโครงสร้างใช้ catch แทนรูปแบบ on
        }

        // กำหนดปฏิทินให้เริ่มต้นด้วยวันปัจจุบัน
        const todayNow = new Date();
        const todayStrFormat = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, '0')}-${String(todayNow.getDate()).padStart(2, '0')}`;
        
        const datePicker = document.getElementById('history-date-picker');
        datePicker.value = todayStrFormat;
        fetchHistoryByDate(todayStrFormat);
        datePicker.addEventListener('change', (e) => {
            fetchHistoryByDate(e.target.value);
        });

        // กำหนดตัวแปรและอีเวนต์สำหรับหน้าต่างประวัติการเล่นเกม
        const gameDatePicker = document.getElementById('gaming-date-picker');
        gameDatePicker.value = todayStrFormat;
        loadDailyGameLog(todayStrFormat);
        gameDatePicker.addEventListener('change', (e) => {
            loadDailyGameLog(e.target.value);
        });

        // กำหนดตัวแปรและอีเวนต์สำหรับหน้าต่างประวัติโปรแกรมการใช้งาน
        const appDatePicker = document.getElementById('app-date-picker');
        appDatePicker.value = todayStrFormat;
        loadDailyAppLog(todayStrFormat);
        appDatePicker.addEventListener('change', (e) => {
            loadDailyAppLog(e.target.value);
        });

        // ===============================================
        // ดำเนินการแสดงอัปเดตข้อมูลแบบเรียลไทม์
        // ===============================================
        const now2 = new Date();
        const todayStr2 = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-${String(now2.getDate()).padStart(2, '0')}`;
        const monthStr2 = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;

        // การแก้ไขข้อผิดพลาด (Bug Fix) ลบฟังก์ชันผู้สังเกตการณ์
        // เนื่องจาก PC_Monitor ให้ผลลัพธ์ต่อเนื่องอยู่แล้ว
        // แก้ปัญหาระบบแสดงผลกระตุกจากตัวแปรซ้ำซ้อน

        // ปรับปรุงความสมเหตุสมผลของการแสดงผลข้อมูลอดีตบนอินเทอร์เฟซ
        window.heroState = { today: 'live', month: 'live' };

        // คำนวณพลังงานจากค่าความถี่การสังเกตผลรวมแบบรายวัน (เที่ยงตรงกว่าระบบรายเดือน)
        db.ref(`users/${user.uid}/daily_summary`).on('value', (snap) => {
            if (window.heroState.month !== 'live') return;

            const allDays = snap.val();
            let totalCost = 0;
            let totalMins = 0;
            if (allDays) {
                // บันทึกรายการรายวันสำหรับปฏิทินเดือน
                const foundMonths = new Set();
                Object.keys(allDays).sort((a,b)=>b.localeCompare(a)).forEach(dateKey => {
                    const mKey = dateKey.substring(0, 7);
                    foundMonths.add(mKey);
                    
                    if (dateKey.startsWith(monthStr2)) {
                        totalCost += Number(allDays[dateKey].cost_thb || 0);
                        totalMins += Number(allDays[dateKey].session_mins || 0);
                    }
                });

                // เพิ่มรายการตัวเลือกเดือน
                const monthSelect = document.getElementById('hero-month-select');
                if (monthSelect && monthSelect.options.length <= 1) {
                    foundMonths.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        // แปลงรูปแบบวันที่ทางโปรแกรมเป็นรูปแบบอักษรภาษาไทย
                        const d = new Date(m + "-01");
                        const mLabel = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                        opt.text = mLabel;
                        monthSelect.add(opt);
                    });
                }
            }
            document.getElementById('costMonthVal').innerText = totalCost.toFixed(2);
            document.getElementById('timeMonthVal').innerText = Math.floor(totalMins / 60) > 0 ? `${Math.floor(totalMins / 60)} ชม. ${Math.floor(totalMins % 60)} นาที` : `${Math.floor(totalMins % 60)} นาที`;
        });

        // 🛠️ Global Functions for Hero Widgets
        window.handleHeroDateHistory = async (dateStr) => {
            if (!dateStr) return;
            const today = new Date().toLocaleDateString('en-CA');
            if (dateStr === today) {
                resetHeroToLive('today');
                return;
            }

            window.heroState.today = 'history';
            document.getElementById('today-card-title-status').innerText = `ค่าไฟวันที่ ${dateStr.split('-').reverse().join('/')}`;
            document.getElementById('reset-today-btn').style.display = 'flex';
            document.getElementById('today-picker-trigger').classList.add('active');

            const snap = await db.ref(`users/${user.uid}/daily_summary/${dateStr}`).once('value');
            const data = snap.val() || { cost_thb: 0, session_mins: 0 };
            
            document.getElementById('costTodayVal').innerText = Number(data.cost_thb || 0).toFixed(2);
            const tm = data.session_mins || 0;
            const h = Math.floor(tm / 60);
            const m = Math.floor(tm % 60);
            document.getElementById('timeTodayVal').innerText = h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
        };

        window.handleHeroMonthHistory = async (mKey) => {
            if (mKey === 'current') {
                resetHeroToLive('month');
                return;
            }

            window.heroState.month = 'history';
            const d = new Date(mKey + "-01");
            const mLabel = d.toLocaleDateString('th-TH', { month: 'long' });
            document.getElementById('month-card-title-status').innerText = `ค่าไฟเดือน${mLabel}`;
            document.getElementById('reset-month-btn').style.display = 'flex';

            const snap = await db.ref(`users/${user.uid}/daily_summary`).once('value');
            const allDays = snap.val() || {};
            let totalCost = 0;
            let totalMins = 0;
            Object.keys(allDays).forEach(dateKey => {
                if (dateKey.startsWith(mKey)) {
                    totalCost += Number(allDays[dateKey].cost_thb || 0);
                    totalMins += Number(allDays[dateKey].session_mins || 0);
                }
            });

            document.getElementById('costMonthVal').innerText = totalCost.toFixed(2);
            document.getElementById('timeMonthVal').innerText = Math.floor(totalMins / 60) > 0 ? `${Math.floor(totalMins / 60)} ชม. ${Math.floor(totalMins % 60)} นาที` : `${Math.floor(totalMins % 60)} นาที`;
        };

        window.resetHeroToLive = (type) => {
            if (type === 'today') {
                window.heroState.today = 'live';
                document.getElementById('today-card-title-status').innerText = 'ค่าไฟวันนี้';
                document.getElementById('reset-today-btn').style.display = 'none';
                document.getElementById('today-picker-trigger').classList.remove('active');
                // ข้อมูลจะถูกอัปเดตอัตโนมัติในรอบต่อไป (1 วินาที)
            } else {
                window.heroState.month = 'live';
                document.getElementById('month-card-title-status').innerText = 'ค่าไฟสะสมเดือนนี้';
                document.getElementById('reset-month-btn').style.display = 'none';
                document.getElementById('hero-month-select').value = 'current';
                // ฟื้นฟูการประมวลผลผ่านตัวรับเหตุการณ์เก่า
                db.ref(`users/${user.uid}/daily_summary`).once('value').then(snap => {
                    // โครงสร้างฟังเงื่อนไขจะรันซ้ำ
                });
            }
        };

    }
});

function fetchDailySummary(uid, dateStr) {
    const resultDiv = document.getElementById('daily-lookup-result');
    if (!resultDiv || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    resultDiv.innerHTML = '<div style="text-align:center; font-size:12px; color:var(--text-sub);">⏳ กำลังโหลดข้อมูล...</div>';

    const db = firebase.database();
    db.ref(`users/${uid}/daily_summary/${dateStr}`).once('value').then((snap) => {
        const d = snap.val();

        // Format the display date nicely
        const parts = dateStr.split('-');
        const displayDate = `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;

        if (!d) {
            resultDiv.innerHTML = `
                <div style="text-align:center; padding: 16px 0;">
                    <span class="material-symbols-rounded" style="font-size:36px; color:var(--text-sub); opacity:0.4;">event_busy</span>
                    <div style="font-size:12px; color:var(--text-sub); margin-top:6px;">ไม่มีข้อมูลในวันที่ ${displayDate}</div>
                </div>`;
            return;
        }

        const mins = d.session_mins || 0;
        const hrs = Math.floor(mins / 60);
        const remMins = Math.floor(mins % 60);
        const cost = Number(d.cost_thb || 0).toFixed(2);
        const avgWatt = d.avg_watt || 0;

        resultDiv.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                <div style="background:rgba(155,89,182,0.12); border:1px solid rgba(155,89,182,0.3); border-radius:14px; padding:14px; text-align:center;">
                    <div style="font-size:10px; color:var(--text-sub); margin-bottom:4px;">เวลาใช้งาน</div>
                    <div style="font-size:22px; font-weight:700; color:var(--purple);">${hrs > 0 ? hrs + '<span style="font-size:14px; opacity:0.7;"> ชม.</span> ' : ''}${remMins}<span style="font-size:14px; opacity:0.7;"> นาที</span></div>
                </div>
                <div style="background:rgba(241,196,15,0.12); border:1px solid rgba(241,196,15,0.3); border-radius:14px; padding:14px; text-align:center;">
                    <div style="font-size:10px; color:var(--text-sub); margin-bottom:4px;">ค่าไฟที่ใช้</div>
                    <div style="font-size:26px; font-weight:700; color:var(--yellow);">฿${cost}</div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:10px;">
                <div style="font-size:11px; color:var(--text-sub);"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:-2px; margin-right:4px;">electric_bolt</span>วัตต์เฉลี่ย</div>
                <div style="font-size:13px; font-weight:600; color:var(--text-main);">${Math.round(avgWatt)} W</div>
            </div>
            <div style="text-align:center; margin-top:8px; font-size:10px; color:var(--text-sub);">📅 ข้อมูลของวันที่ ${displayDate}</div>`;
    }).catch(() => {
        resultDiv.innerHTML = '<div style="text-align:center; font-size:12px; color:var(--red);">❌ ไม่สามารถโหลดข้อมูลได้</div>';
    });
}

// =====================================================
// 🎮 Gaming Log — daily_game_log / monthly_game_log
// =====================================================
window.showGamingTab = (mode) => {
    const isDaily = mode === 'daily';
    document.getElementById('toggle-daily').classList.toggle('active', isDaily);
    document.getElementById('toggle-monthly').classList.toggle('active', !isDaily);
    document.getElementById('gaming-date-row').style.display = isDaily ? 'flex' : 'none';
    document.getElementById('gaming-monthly-days').style.display = isDaily ? 'none' : 'block';
    document.getElementById('gaming-summary-label').innerText = isDaily ? 'รวมวันนี้' : 'รวมเดือนนี้';
    if (isDaily) {
        loadDailyGameLog(document.getElementById('gaming-date-picker').value);
    } else {
        loadMonthlyGameLog();
    }
};

function renderGamesList(games, containerEl) {
    if (!games || Object.keys(games).length === 0) {
        containerEl.innerHTML = '<div id="gaming-log-empty">ไม่มีข้อมูลเกมในช่วงนี้</div>';
        return;
    }
    
    const sorted = Object.values(games).sort((a, b) => b.total_mins - a.total_mins);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    
    let html = '';
    
    const generateGameHtml = (g) => {
        const hrs = Math.floor(g.total_mins / 60);
        const mins = Math.round(g.total_mins % 60);
        const timeStr = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
        let cardHtml = `<div class="game-log-card">
            <div class="game-log-title">
                <span><span class="material-symbols-rounded" style="font-size:14px; vertical-align:-2px; margin-right:4px;">sports_esports</span> ${escapeHtml((g.name || g || '').replace(/\.exe/gi, '').replace(/_exe/gi, ''))}</span>
                <span class="game-log-mins">${timeStr}</span>
            </div>
            <div class="game-log-sub">ค่าไฟ ฿${Number(g.total_cost_thb || 0).toFixed(4)}</div>`;
        
        // เตรียมการสำหรับย่อรายการเพื่อให้รองรับประวัติ 5 รอบสุดท้าย
        if (g.sessions && g.sessions.length > 0) {
            let recent_sessions = g.sessions.slice(-5).reverse();
            recent_sessions.forEach(s => {
                cardHtml += `<div class="game-row">
                    <div class="game-row-name"><span class="material-symbols-rounded" style="font-size:14px;">schedule</span> ${escapeHtml(s.start)} – ${escapeHtml(s.end)}</div>
                    <div class="game-row-mins">${escapeHtml(s.mins)} นาที</div>
                </div>`;
            });
        }
        cardHtml += '</div>';
        return cardHtml;
    };

    // แสดง 3 รายการล่าสุดเสมอ
    top3.forEach(g => { html += generateGameHtml(g); });
    
    // ซ่อนประวัติที่เก่ากว่าและสามารถตั้งให้ตอบสนองการกดได้
    if (rest.length > 0) {
       const uniqueId = 'more-games-list-' + Math.random().toString(36).substr(2, 9);
       html += `
       <div onclick="const list = document.getElementById('${uniqueId}'); const icon = this.querySelector('.material-symbols-rounded'); if(list.style.display === 'none'){ list.style.display = 'block'; icon.innerText = 'keyboard_arrow_up'; this.style.color='var(--primary)'; } else { list.style.display = 'none'; icon.innerText = 'keyboard_arrow_down'; this.style.color='var(--text-sub)'; }" 
            style="display:flex; justify-content:center; align-items:center; gap:4px; margin-top:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:12px; font-size:11px; font-weight:700; color:var(--text-sub); cursor:pointer; transition:0.2s;">
           (และเกมอื่นๆ อีก ${rest.length} เกม)
           <span class="material-symbols-rounded" style="font-size:16px;">keyboard_arrow_down</span>
       </div>
       <div id="${uniqueId}" style="display:none; margin-top:8px;">
       `;
       rest.forEach(g => { html += generateGameHtml(g); });
       html += `</div>`;
    }
    
    containerEl.innerHTML = html;
}

function loadDailyGameLog(dateStr) {
    const uid = auth.currentUser?.uid;
    if (!uid || !dateStr) return;
    document.getElementById('gaming-games-list').innerHTML = '<div id="gaming-log-empty">กำลังโหลด...</div>';
    db.ref(`users/${uid}/daily_game_log/${dateStr}`).once('value').then(snap => {
        const data = snap.val();
        if (data) {
            let dTm = data.total_mins || 0;
            document.getElementById('gaming-total-mins').innerText = `${Math.floor(dTm / 60)}.${Math.floor(dTm % 60).toString().padStart(2, '0')}`;
            document.getElementById('gaming-total-cost').innerText = Number(data.total_cost_thb || 0).toFixed(2);
            renderGamesList(data.games, document.getElementById('gaming-games-list'));
        } else {
            document.getElementById('gaming-total-mins').innerText = '0.0';
            document.getElementById('gaming-total-cost').innerText = '0.00';
            document.getElementById('gaming-games-list').innerHTML = '<div id="gaming-log-empty">ไม่มีข้อมูลเกมในวันนี้</div>';
        }
    }).catch(() => {
        document.getElementById('gaming-games-list').innerHTML = '<div id="gaming-log-empty">โหลดข้อมูลไม่สำเร็จ</div>';
    });
}

function loadMonthlyGameLog() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('gaming-games-list').innerHTML = '<div id="gaming-log-empty">กำลังโหลด...</div>';
    document.getElementById('gaming-days-list').innerHTML = '';

    db.ref(`users/${uid}/monthly_game_log/${monthStr}`).once('value').then(snap => {
        const data = snap.val();
        if (data) {
            let pTm = data.total_mins || 0;
            document.getElementById('gaming-total-mins').innerText = `${Math.floor(pTm / 60)}.${Math.floor(pTm % 60).toString().padStart(2, '0')}`;
            document.getElementById('gaming-total-cost').innerText = Number(data.total_cost_thb || 0).toFixed(2);
            renderGamesList(data.games, document.getElementById('gaming-games-list'));
        } else {
            document.getElementById('gaming-total-mins').innerText = '0.0';
            document.getElementById('gaming-total-cost').innerText = '0.00';
            document.getElementById('gaming-games-list').innerHTML = '<div id="gaming-log-empty">ยังไม่มีข้อมูลเกมเดือนนี้</div>';
        }
    });

    // การแก้ไขข้อผิดพลาด (Bug Fix) #8: เรียกผลเฉพาะเดือนปัจจุปันเพื่อลดแบนด์วิดท์
    db.ref(`users/${uid}/daily_game_log`).orderByKey().startAt(monthStr).endAt(monthStr + '\uf8ff').once('value').then(snap => {
        const allDays = snap.val();
        if (!allDays) return;
        const daysInMonth = Object.keys(allDays).sort().reverse();
        let daysHtml = '';
        daysInMonth.forEach(d => {
            const day = allDays[d];
            const hrs = Math.floor(day.total_mins / 60);
            const mins = Math.round(day.total_mins % 60);
            const timeStr = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
            const gameNames = Object.values(day.games || {}).map(g => g.name || g).join(', ');
            daysHtml += `<div class="game-row">
                <div class="game-row-name"><span class="material-symbols-rounded" style="font-size:14px;">calendar_today</span> ${d}</div>
                <div style="text-align:right;">
                    <div class="game-row-mins">${timeStr}</div>
                    <div style="font-size:10px; color:var(--text-sub);">${escapeHtml(gameNames)}</div>
                </div>
            </div>`;
        });
        if (daysHtml) {
            document.getElementById('gaming-days-list').innerHTML = `<div class="card" style="padding:14px;">${daysHtml}</div>`;
        }
    });
}


// =====================================================
// 📱 App Usage Log (Daily / Monthly)
// =====================================================
window.showAppTab = (mode) => {
    const isDaily = mode === 'daily';
    document.getElementById('toggle-app-daily').classList.toggle('active', isDaily);
    document.getElementById('toggle-app-monthly').classList.toggle('active', !isDaily);
    document.getElementById('app-date-row').style.display = isDaily ? 'flex' : 'none';
    document.getElementById('app-monthly-days').style.display = isDaily ? 'none' : 'block';
    document.getElementById('app-summary-label').innerText = isDaily ? 'เวลาประมวลผลหนัก วันนี้' : 'เวลาประมวลผลหนัก เดือนนี้';
    if (isDaily) {
        loadDailyAppLog(document.getElementById('app-date-picker').value);
    } else {
        loadMonthlyAppLog();
    }
};

function renderAppList(apps_dict, containerEl) {
    if (!apps_dict || Object.keys(apps_dict).length === 0) {
        containerEl.innerHTML = '<div id="gaming-log-empty">ไม่มีข้อมูลโปรแกรมในช่วงนี้</div>';
        return;
    }
    
    const sorted = Object.values(apps_dict).sort((a, b) => b.total_mins - a.total_mins);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    
    let html = '';
    
    const generateAppHtml = (app) => {
        const hrs = Math.floor(app.total_mins / 60);
        const mins = Math.round(app.total_mins % 60);
        const timeStr = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
        return `<div class="game-log-card" style="padding:12px 16px;">
            <div class="game-log-title">
                <span style="font-size:13px;"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:-2px; margin-right:4px;">apps</span> ${escapeHtml((app.name || '').replace(/\.exe/gi, '').replace(/_exe/gi, ''))}</span>
                <span class="game-log-mins" style="color:var(--text-main);">${timeStr}</span>
            </div>
        </div>`;
    };

    top3.forEach(a => { html += generateAppHtml(a); });
    
    if (rest.length > 0) {
       const uniqueId = 'more-apps-list-' + Math.random().toString(36).substr(2, 9);
       html += `
       <div onclick="const list = document.getElementById('${uniqueId}'); const icon = this.querySelector('.material-symbols-rounded'); if(list.style.display === 'none'){ list.style.display = 'block'; icon.innerText = 'keyboard_arrow_up'; this.style.color='var(--blue)'; } else { list.style.display = 'none'; icon.innerText = 'keyboard_arrow_down'; this.style.color='var(--text-sub)'; }" 
            style="display:flex; justify-content:center; align-items:center; gap:4px; margin-top:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:12px; font-size:11px; font-weight:700; color:var(--text-sub); cursor:pointer; transition:0.2s;">
           (และโปรแกรมอื่นๆ อีก ${rest.length} รายการ)
           <span class="material-symbols-rounded" style="font-size:16px;">keyboard_arrow_down</span>
       </div>
       <div id="${uniqueId}" style="display:none; margin-top:8px;">
       `;
       rest.forEach(a => { html += generateAppHtml(a); });
       html += `</div>`;
    }
    
    containerEl.innerHTML = html;
}

function loadDailyAppLog(dateStr) {
    const uid = auth.currentUser?.uid;
    if (!uid || !dateStr) return;
    document.getElementById('app-list').innerHTML = '<div id="gaming-log-empty">กำลังโหลด...</div>';
    db.ref(`users/${uid}/daily_app_log/${dateStr}`).once('value').then(snap => {
        const data = snap.val();
        if (data) {
            let dTm = data.total_mins || 0;
            document.getElementById('app-total-mins').innerText = `${Math.floor(dTm / 60)}.${Math.floor(dTm % 60).toString().padStart(2, '0')}`;
            renderAppList(data.apps, document.getElementById('app-list'));
        } else {
            document.getElementById('app-total-mins').innerText = '0.0';
            document.getElementById('app-list').innerHTML = '<div id="gaming-log-empty">ไม่มีข้อมูลโปรแกรมในวันนี้</div>';
        }
    }).catch(() => {
        document.getElementById('app-list').innerHTML = '<div id="gaming-log-empty">โหลดข้อมูลไม่สำเร็จ</div>';
    });
}

function loadMonthlyAppLog() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('app-list').innerHTML = '<div id="gaming-log-empty">กำลังโหลด...</div>';
    document.getElementById('app-monthly-list').innerHTML = '';

    db.ref(`users/${uid}/monthly_app_log/${monthStr}`).once('value').then(snap => {
        const data = snap.val();
        if (data) {
            let pTm = data.total_mins || 0;
            document.getElementById('app-total-mins').innerText = `${Math.floor(pTm / 60)}.${Math.floor(pTm % 60).toString().padStart(2, '0')}`;
            renderAppList(data.apps, document.getElementById('app-list'));
        } else {
            document.getElementById('app-total-mins').innerText = '0.0';
            document.getElementById('app-list').innerHTML = '<div id="gaming-log-empty">ยังไม่มีข้อมูลโปรแกรมเดือนนี้</div>';
        }
    });

    // การแก้ไขข้อผิดพลาด (Bug Fix) #9: เรียกผลเฉพาะเดือนปัจจุปันเพื่อลดแบนด์วิดท์
    db.ref(`users/${uid}/daily_app_log`).orderByKey().startAt(monthStr).endAt(monthStr + '\uf8ff').once('value').then(snap => {
        const allDays = snap.val();
        if (!allDays) return;
        const daysInMonth = Object.keys(allDays).sort().reverse();
        let daysHtml = '';
        daysInMonth.forEach(d => {
            const day = allDays[d];
            const hrs = Math.floor(day.total_mins / 60);
            const mins = Math.round(day.total_mins % 60);
            const timeStr = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
            const appNames = Object.values(day.apps || {}).map(a => a.name).join(', ');
            daysHtml += `<div class="game-row">
                <div class="game-row-name"><span class="material-symbols-rounded" style="font-size:14px;">calendar_today</span> ${d}</div>
                <div style="text-align:right;">
                    <div class="game-row-mins">${timeStr}</div>
                    <div style="font-size:10px; color:var(--text-sub);">${escapeHtml(appNames)}</div>
                </div>
            </div>`;
        });
        if (daysHtml) {
            document.getElementById('app-monthly-list').innerHTML = `<div class="card" style="padding:14px;">${daysHtml}</div>`;
        }
    });
}

// =====================================================
// 📊 Monthly Summary + Yearly Summary
// =====================================================
function initYearSelect() {
    const sel = document.getElementById('year-select');
    const mSel = document.getElementById('month-select');
    const thisYear = new Date().getFullYear();
    const thisMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    sel.innerHTML = '';
    for (let y = thisYear; y >= thisYear - 3; y--) {
        const opt = document.createElement('option');
        opt.value = y; opt.text = y + ' ปี';
        if (y === thisYear) opt.selected = true;
        sel.appendChild(opt);
    }
    
    // กำหนดเดือนตัวแปรหลักเท่ากับปัจจุปัน
    if(mSel) mSel.value = thisMonth;

    sel.addEventListener('change', () => loadYearlySummary(parseInt(sel.value)));
    if(mSel) mSel.addEventListener('change', () => loadYearlySummary(parseInt(sel.value)));
}

function loadYearlySummary(year) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const beYear = parseInt(year) + 543;
    document.getElementById('year-label').innerText = `${year} (พ.ศ. ${beYear})`;
    document.getElementById('summary-loading').style.display = 'block';
    document.getElementById('monthly-summary-list').innerHTML = '';
    document.getElementById('year-total-bar').style.display = 'none';

    // คำนวณรวบรวมค่าสรุปรายวันเพื่อแก้ปัญหาข้อผิดพลาดฐานข้อมูล
    const dailyRef = db.ref(`users/${uid}/daily_summary`);
    const gameLogRef = db.ref(`users/${uid}/daily_game_log`);
    const monitorRef = db.ref(`users/${uid}/PC_Monitor`);
    const monthlyRef = db.ref(`users/${uid}/monthly_summary`)
        .orderByKey()
        .startAt(String(year))
        .endAt(String(year) + "\uf8ff");

    Promise.all([monthlyRef.once('value'), dailyRef.once('value'), gameLogRef.once('value'), monitorRef.once('value')]).then(([monthSnap, dailySnap, gameSnap, monitorSnap]) => {
        document.getElementById('summary-loading').style.display = 'none';
        const allMonths = monthSnap.val();
        const allDays = (dailySnap.val() || {});
        const allGameLogs = gameSnap.val() || {};
        const monitorData = monitorSnap.val() || {};

        // รวมศูนย์ข้อมูลวันนี้ให้ตรงกับค่าเรียลไทม์ (PC_Monitor)
        const todayStr = new Date().toLocaleDateString('en-CA'); // "YYYY-MM-DD"
        if (monitorData.Daily_Cost_THB !== undefined) {
            allDays[todayStr] = {
                ...allDays[todayStr],
                cost_thb: monitorData.Daily_Cost_THB,
                total_kwh: monitorData.Daily_KWh || 0,
                session_mins: monitorData.Daily_Mins || 0
            };
        }

        // ควรรวมรอบรายวันเป็นหน่วยเดือนเพื่อลดช่องว่างของข้อผิดพลาด
        const dailyByMonth = {};
        Object.keys(allDays).forEach(dateKey => {
            if (!dateKey.startsWith(String(year))) return;
            const monthKey = dateKey.substring(0, 7); // "2026-04"
            if (!dailyByMonth[monthKey]) dailyByMonth[monthKey] = { cost: 0, mins: 0, kwh: 0, game_mins: 0 };
            dailyByMonth[monthKey].cost += Number(allDays[dateKey].cost_thb || 0);
            dailyByMonth[monthKey].mins += Number(allDays[dateKey].session_mins || 0);
            dailyByMonth[monthKey].kwh += Number(allDays[dateKey].total_kwh || 0);
        });

        // คำนวณค่าเวลารวมจากระบบสรุปผลรายวัน
        Object.keys(allGameLogs).forEach(dateKey => {
            if (!dateKey.startsWith(String(year))) return;
            const monthKey = dateKey.substring(0, 7);
            if (!dailyByMonth[monthKey]) dailyByMonth[monthKey] = { cost: 0, mins: 0, game_mins: 0 };
            dailyByMonth[monthKey].game_mins += Number(allGameLogs[dateKey].total_mins || 0);
        });

        if (!allMonths && Object.keys(dailyByMonth).length === 0) {
            document.getElementById('monthly-summary-list').innerHTML =
                '<div style="text-align:center;padding:30px;color:var(--text-sub);font-size:13px;">ยังไม่มีข้อมูลสรุปรายเดือน<br><small>ข้อมูลจะเริ่มสะสมหลังโปรแกรม Python รันครบ 1 ชม.</small></div>';
            return;
        }

        // เชื่อมชุดรหัสประจำกุญแจสรุปผลร่วมเพื่อไม่ให้เกิดฐานข้อมูลสูญหาย
        const allMonthKeys = new Set([
            ...Object.keys(allMonths || {}),
            ...Object.keys(dailyByMonth)
        ]);
        const months = [...allMonthKeys]
            .filter(k => k.startsWith(String(year)))
            .sort((a, b) => b.localeCompare(a));

        if (months.length === 0) {
            document.getElementById('monthly-summary-list').innerHTML =
                `<div style="text-align:center;padding:30px;color:var(--text-sub);font-size:13px;">ไม่มีข้อมูลปี ${year}</div>`;
            return;
        }

        const mFilter = document.getElementById('month-select')?.value || 'all';

        let yrHrsSum = 0, yrMinsSum = 0, yrCost = 0, yrKwh = 0, yrGameHrs = 0, yrGameMins = 0, yrCpuSum = 0, yrRamSum = 0;
        let yrAllApps = {};
        let html = '';
        months.forEach(monthKey => {
            const m = (allMonths || {})[monthKey] || {};
            const daily = dailyByMonth[monthKey] || {};

            // ดึงผลลัพธ์ผ่านจากวิธีผลรวมเพื่อความเที่ยงตรงยิ่งขึ้น
            const monthCost = daily.cost || Number(m.total_cost_thb || 0);
            const monthMinsTotal = daily.mins || (Number(m.total_session_mins || 0));
            const monthKwhTotal = daily.kwh || Number(m.total_kwh || 0);
            
            const monthHrs = Math.floor(monthMinsTotal / 60);
            const monthMins = Math.floor(monthMinsTotal % 60);
            const monthTimeStr = monthHrs > 0 ? `${monthHrs} ชม. ${monthMins} นาที` : `${monthMins} นาที`;

            const monthGameMinsTotal = daily.game_mins || (Number(m.game_hrs || 0) * 60);
            const monthGameHrs = Math.floor(monthGameMinsTotal / 60);
            const monthGameMins = Math.floor(monthGameMinsTotal % 60);
            const monthGameTimeStr = monthGameHrs > 0 ? `${monthGameHrs} ชม. ${monthGameMins} นาที` : `${monthGameMins} นาที`;

            yrHrsSum += Math.floor(monthMinsTotal / 60);
            yrMinsSum += Math.floor(monthMinsTotal % 60);
            yrCost += monthCost;
            yrKwh += monthKwhTotal;
            yrGameHrs += monthGameHrs;
            yrGameMins += monthGameMins;
            yrCpuSum += Number(m.avg_cpu || 0);
            yrRamSum += Number(m.avg_ram || 0);
            
            // รวบรวมแอปพลิเคชันยอดนิยมในรอบปี
            if (m.top_apps_count) {
                Object.entries(m.top_apps_count).forEach(([name, count]) => {
                    // Normalize name
                    const clean = name.replace(/\.exe/gi, '').replace(/_exe/gi, '');
                    yrAllApps[clean] = (yrAllApps[clean] || 0) + count;
                });
            }

            const topApps = Object.entries(m.top_apps_count || {})
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([name]) => `<span class="ym-app-chip">${escapeHtml(name.replace(/\.exe/gi, '').replace(/_exe/gi, ''))}</span>`).join('');

            const isMatch = (mFilter === 'all' || monthKey.endsWith('-' + mFilter));
            if (isMatch) {
                const monthName = new Date(monthKey + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                html += `<div class="year-month-card">
                    <div class="ym-header">
                        <div class="ym-month"><span class="material-symbols-rounded" style="font-size:14px; vertical-align:-2px; margin-right:4px;">calendar_month</span> ${monthName}</div>
                        <div class="ym-cost">฿${monthCost.toFixed(2)}</div>
                    </div>
                    <div class="ym-stats-grid">
                        <div class="ym-stat">
                            <div class="ym-stat-val" style="color:var(--primary);">${monthTimeStr}</div>
                            <div class="ym-stat-label">ใช้งาน</div>
                        </div>
                        <div class="ym-stat">
                            <div class="ym-stat-val" style="color:var(--red);">${monthGameTimeStr}</div>
                            <div class="ym-stat-label">เล่นเกม</div>
                        </div>
                        <div class="ym-stat">
                            <div class="ym-stat-val" style="color:var(--yellow);">${monthKwhTotal.toFixed(2)}<small style="font-size:11px;"> kWh</small></div>
                            <div class="ym-stat-label">พลังงาน</div>
                        </div>
                        <div class="ym-stat">
                            <div class="ym-stat-val" style="color:var(--blue);">${Number(m.avg_cpu || 0).toFixed(1)}<small style="font-size:11px;">%</small></div>
                            <div class="ym-stat-label">avg CPU</div>
                        </div>
                        <div class="ym-stat">
                            <div class="ym-stat-val" style="color:var(--yellow);">${Number(m.avg_ram || 0).toFixed(1)}<small style="font-size:11px;">%</small></div>
                            <div class="ym-stat-label">avg RAM</div>
                        </div>
                        <div class="ym-stat">
                            <div class="ym-stat-val" style="color:var(--purple);">${Number(m.avg_watt || 0).toFixed(1)}<small style="font-size:11px;">W</small></div>
                            <div class="ym-stat-label">avg Watt</div>
                        </div>
                    </div>
                    ${topApps ? `<div class="ym-apps">${topApps}</div>` : ''}
                </div>`;
            }
        });

        if (html === '' && mFilter !== 'all') {
            html = `<div style="text-align:center;padding:30px;color:var(--text-sub);font-size:13px;">ไม่มีข้อมูลของเดือนที่เลือก</div>`;
        }

        document.getElementById('monthly-summary-list').innerHTML = html;

        const n = months.length;
        // เปลี่ยนค่าเวลาเป็นมาตรฐาน (ชั่วโมง และ นาที)
        const totalYrHrs = yrHrsSum + Math.floor(yrMinsSum / 60);
        const totalYrMins = yrMinsSum % 60;
        document.getElementById('yr-total-hrs').innerText = totalYrHrs > 0 ? `${totalYrHrs} ชม. ${totalYrMins} นาที` : `${totalYrMins} นาที`;
        
        const totalYrGameHrs = yrGameHrs + Math.floor(yrGameMins / 60);
        const totalYrGameMins = yrGameMins % 60;
        document.getElementById('yr-total-game').innerText = totalYrGameHrs > 0 ? `${totalYrGameHrs} ชม. ${totalYrGameMins} นาที` : `${totalYrGameMins} นาที`;

        document.getElementById('yr-total-cost').innerText = '฿' + yrCost.toFixed(2);
        document.getElementById('yr-total-kwh').innerText = yrKwh.toFixed(2) + ' kWh';
        document.getElementById('yr-avg-cpu').innerText = (yrCpuSum / n).toFixed(1) + '%';
        document.getElementById('yr-avg-ram').innerText = (yrRamSum / n).toFixed(1) + '%';
        
        // คัดแยก 5 แอปพลิเคชันแรกในรอบปี
        const sortedYrApps = Object.entries(yrAllApps)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        let yrTopAppsHtml = sortedYrApps.map(([name]) => `<span class="ym-app-chip">${escapeHtml(name)}</span>`).join('');
        document.getElementById('yr-top-apps').innerHTML = yrTopAppsHtml || '–';

        document.getElementById('year-total-bar').style.display = 'block';
    }).catch(() => {
        document.getElementById('summary-loading').style.display = 'none';
        document.getElementById('monthly-summary-list').innerHTML =
            '<div style="text-align:center;padding:20px;color:var(--red);">โหลดข้อมูลไม่สำเร็จ</div>';
    });
}

// การแก้ไขข้อผิดพลาด (Bug Fix) #3: ลบผู้ตรวจจับเพื่อไม่ให้ซ้ำซ้อนกับคำสั่งชุดอื่น
// ตัดลำดับคำสั่งเพื่อป้องกันการร้องขอฐานข้อมูลเกินความจำเป็น

// เมื่อหน้าจอถูกสลับเป็นสถิติประวัติจะร้องขอการใช้งาน
let _yearlyLoaded = false;
let _historyTabLoaded = false; // การแก้ไขข้อผิดพลาด (Bug Fix) #14: ระงับการโหลดใหม่ตามกรณีข้อมูลคงที่
const origSwitchTab = window.switchTab;
window.switchTab = (tabId, element) => {
    origSwitchTab(tabId, element);
    if (tabId === 'history') {
        if (!_historyTabLoaded) {
            _historyTabLoaded = true;
            const isDaily = document.getElementById('toggle-daily').classList.contains('active');
            if (isDaily) loadDailyGameLog(document.getElementById('gaming-date-picker').value);
            else loadMonthlyGameLog();
        }
        if (!_yearlyLoaded) {
            _yearlyLoaded = true;
            initYearSelect();
            loadYearlySummary(new Date().getFullYear());
        }
    } else {
        _historyTabLoaded = false; // ป้อนการคืนค่าเพื่อร้องขอประวัติในกรณีออกจากหน้าไปก่อนและกลับ
    }
};

function updateCharts(labels, cpu, gpu, ram, watt, netDl, netUl, cpuTemp, gpuTemp) {
    Chart.defaults.color = '#a4b0be';
    Chart.defaults.font.family = 'Prompt';

    const ctxCpu = document.getElementById('chart-cpu').getContext('2d');
    if (chartCpu) chartCpu.destroy();
    chartCpu = new Chart(ctxCpu, {
        type: 'line', data: { labels: labels, datasets: [{ label: 'CPU %', data: cpu, borderColor: '#20c997', backgroundColor: 'rgba(32, 201, 151, 0.2)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } }
    });

    const ctxRam = document.getElementById('chart-ram').getContext('2d');
    if (chartRam) chartRam.destroy();
    chartRam = new Chart(ctxRam, {
        type: 'line', data: { labels: labels, datasets: [{ label: 'GPU %', data: gpu, borderColor: '#3498db', tension: 0.4 }, { label: 'RAM %', data: ram, borderColor: '#f1c40f', tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { position: 'bottom' } } }
    });

    const ctxWatt = document.getElementById('chart-watt').getContext('2d');
    if (chartWatt) chartWatt.destroy();
    chartWatt = new Chart(ctxWatt, {
        type: 'line', data: { labels: labels, datasets: [{ label: 'พลังงาน (Watt)', data: watt, borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.2)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });

    const ctxTemp = document.getElementById('chart-temp').getContext('2d');
    if (chartTemp) chartTemp.destroy();
    chartTemp = new Chart(ctxTemp, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'CPU °C', data: cpuTemp || [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.15)', fill: true, tension: 0.4 },
                { label: 'GPU °C', data: gpuTemp || [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.10)', fill: true, tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: false, suggestedMin: 30, suggestedMax: 100, ticks: { callback: v => v + '°C' } } },
            plugins: { legend: { position: 'bottom' } }
        }
    });

    const ctxNet = document.getElementById('chart-net').getContext('2d');
    if (chartNet) chartNet.destroy();
    chartNet = new Chart(ctxNet, {
        type: 'line', data: {
            labels: labels, datasets: [
                { label: 'Download (Mbps)', data: netDl, borderColor: '#20c997', tension: 0.4 },
                { label: 'Upload (Mbps)', data: netUl, borderColor: '#9b59b6', tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
    });
}

window.setTimer = () => {
    // การแก้ไขข้อผิดพลาด (Bug Fix) #6: เปลี่ยนประเภทและหักค่าที่เป็นไปไม่ได้ออก
    const mins = parseInt(document.getElementById('timer-mins').value);
    const uid = auth.currentUser?.uid;
    if (!uid || !isRemoteControlReady() || isNaN(mins) || mins <= 0 || mins > 24 * 60) { if (uid && (mins <= 0 || mins > 24 * 60)) showToast('⚠️ ตั้งเวลาได้ 1–1440 นาที', 'error'); return; }
    showConfirm({
        icon: '⏳',
        title: `ตั้งเวลาปิดเครื่อง`,
        body: `ยืนยันตั้งเวลาปิดเครื่องในอีก <b>${mins} นาที</b> ใช่ไหมครับ?`,
        confirmText: 'เริ่มจับเวลา',
        onConfirm: () => {
            db.ref(`users/${uid}/PC_Control/command`).set(makeCommand(`timer:${mins}`))
                .catch((err) => { console.error(err); showToast('❌ ตั้งเวลาไม่สำเร็จ', 'error'); });
            showToast(`⏳ ตั้งเวลาปิดเครื่องใน ${mins} นาทีแล้ว`);
        }
    });
};

window.cancelTimer = () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isRemoteControlReady()) return;
    db.ref(`users/${uid}/PC_Control/command`).set(makeCommand('timer:cancel'))
        .then(() => showToast('✅ ยกเลิกตัวตั้งเวลาปิดเครื่องแล้ว'))
        .catch((err) => { console.error(err); showToast('❌ ยกเลิกตัวตั้งเวลาไม่สำเร็จ', 'error'); });
};

// =====================================================
// บริการแจกรังแจ้งเตือนอัตโนมัติภายในแอปพลิเคชัน (In-App Notifications)
// =====================================================
let _notifList = JSON.parse(localStorage.getItem("rc_notifs") || "[]");
let _notifPanelOpen = false;

function _saveNotifs() {
    _notifList = _notifList.slice(0, 30);
    localStorage.setItem("rc_notifs", JSON.stringify(_notifList));
}

function _updateBellBadge() {
    const unread = _notifList.filter(n => !n.read).length;
    const badge = document.getElementById("notif-badge");
    if (badge) badge.style.display = unread > 0 ? "block" : "none";
}

function _renderNotifPanel() {
    const list = document.getElementById("notif-list");
    if (!list) return;
    if (_notifList.length === 0) {
        list.innerHTML = `<div style="padding:24px;text-align:center;font-size:12px;color:var(--text-sub)">ยังไม่มีการแจ้งเตือน</div>`;
        return;
    }
    list.innerHTML = _notifList.map((n, idx) => {
        let actionsHtml = '';
        if (n.type === 'suspect' && !n.resolved) {
            actionsHtml = `<div style="display:flex;gap:8px;margin-top:8px;">
                <button class="suspect-action" data-index="${idx}" data-answer="yes" style="flex:1;padding:6px 0;border:none;border-radius:8px;background:var(--primary);color:#1e212b;font-size:11px;font-weight:700;font-family:'Prompt';cursor:pointer;">ใช่, เป็นเกม</button>
                <button class="suspect-action" data-index="${idx}" data-answer="no" style="flex:1;padding:6px 0;border:none;border-radius:8px;background:rgba(231,76,60,.2);color:var(--red);font-size:11px;font-weight:700;font-family:'Prompt';cursor:pointer;">ไม่ใช่</button>
            </div>`;
        } else if (n.type === 'suspect' && n.resolved) {
            actionsHtml = `<div style="font-size:10px;color:var(--text-sub);margin-top:4px;font-style:italic;">${n.resolved === 'yes' ? '✅ จำไว้แล้วว่าเป็นเกม' : '❌ ลบข้อมูลแล้ว'}</div>`;
        }
        return `<div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.05);${!n.read ? 'background:rgba(32,201,151,.04)' : ''}">
            <div style="display:flex;gap:10px;">
                <div style="flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border-radius:10px;"><span class="material-symbols-rounded" style="font-size:20px;color:${escapeHtml(n.color || 'var(--text-main)')}">${escapeHtml(n.icon)}</span></div>
                <div style="flex:1">
                    <div style="font-size:12px;font-weight:700;color:${escapeHtml(n.color || 'var(--text-main)')}">${escapeHtml(n.title)}</div>
                    <div style="font-size:11px;color:var(--text-sub);margin-top:2px">${escapeHtml(n.body)}</div>
                    <div style="font-size:10px;color:var(--text-sub);margin-top:4px;opacity:.6">${escapeHtml(n.time)}</div>
                    ${actionsHtml}
                </div>
                ${!n.read ? '<div style="width:7px;height:7px;background:var(--primary);border-radius:50%;flex-shrink:0;margin-top:4px"></div>' : ''}
            </div>
        </div>`;
    }).join("");
    list.querySelectorAll('.suspect-action').forEach(btn => {
        btn.addEventListener('click', () => window._resolveSuspect(Number(btn.dataset.index), btn.dataset.answer === 'yes'));
    });
}

function showBellPopup(icon, title, body, color) {
    const popup = document.createElement('div');
    popup.style.cssText = `position:fixed;top:60px;right:12px;z-index:9999;background:var(--bg-card);border:var(--card-border);border-radius:12px;padding:12px 16px;min-width:220px;max-width:calc(100vw - 24px);box-shadow:0 10px 30px rgba(0,0,0,0.4);display:flex;gap:12px;align-items:flex-start;animation:slideToast .4s cubic-bezier(.175,.885,.32,1.275);color:var(--text-main);backdrop-filter:blur(20px);`;
    if (color && /^var\(--[a-z-]+\)$/.test(color)) popup.style.borderLeft = `4px solid ${color}`;
    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-rounded'; iconEl.style.fontSize='20px'; iconEl.style.color = /^var\(--[a-z-]+\)$/.test(color||'') ? color : 'var(--primary)'; iconEl.textContent = icon;
    const iconWrap = document.createElement('div'); iconWrap.style.cssText='flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(128,128,128,.1);border-radius:10px;'; iconWrap.appendChild(iconEl);
    const textWrap = document.createElement('div');
    const titleEl=document.createElement('div'); titleEl.style.cssText='font-size:13px;font-weight:700;'; titleEl.style.color=iconEl.style.color; titleEl.textContent=title;
    const bodyEl=document.createElement('div'); bodyEl.style.cssText='font-size:11px;color:var(--text-sub);margin-top:2px;'; bodyEl.textContent=String(body||'').replace(/\.exe/gi,'').replace(/_exe/gi,'');
    textWrap.appendChild(titleEl); textWrap.appendChild(bodyEl); popup.appendChild(iconWrap); popup.appendChild(textWrap); document.body.appendChild(popup);
    setTimeout(() => { popup.style.transition='all .4s ease-in'; popup.style.opacity='0'; popup.style.transform='translateY(-20px) scale(.9)'; setTimeout(()=>popup.remove(),400); },5000);
}


// หมวดหมู่พิเศษ (Suspect Notification)
window.addSuspectNotification = function (uid, suspectData) {
    const now = new Date();
    const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    _notifList.unshift({
        type: 'suspect',
        icon: 'smart_toy',
        title: `ตรวจพบ: ${suspectData.name}`,
        body: `CPU: ${suspectData.cpu_pct}% | RAM: ${suspectData.ram_gb}GB`,
        color: 'var(--blue)',
        time: time,
        read: false,
        resolved: null,
        suspect_uid: uid,
        suspect_name: suspectData.name
    });
    _saveNotifs();
    _updateBellBadge();
    if (_notifPanelOpen) _renderNotifPanel();

    // ประมวลผลหน้าต่างป๊อปอัปทันที
    showBellPopup('smart_toy', `ตรวจพบ: ${suspectData.name}`, 'นี่คือเกมใช่ไหม? (กดที่กระดิ่งเพื่อเลือก)', 'var(--primary)');
};

// 🎮 AI Game Management Modal
window.openGameManageModal = function() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    document.getElementById('game-manage-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';

    // Fetch and render Custom Games
    db.ref(`users/${uid}/ai_settings/custom_games`).on('value', (snap) => {
        let html = '';
        if (snap.exists()) {
            const data = snap.val();
            for (let key in data) {
                let name = data[key];
                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#292e39; border-radius:10px; margin-bottom:8px;">
                    <div style="font-size:13px; color:#fff;">${escapeHtml((name || '').replace(/\.exe/gi, '').replace(/_exe/gi, ''))}</div>
                    <button class="kill-btn" style="color:var(--red); border-color:var(--red); padding:4px 8px; font-size:12px; width:auto; border-radius:6px;" data-key="${escapeHtml(key)}" data-action="remove-custom">ลบ</button>
                </div>`;
            }
        } else {
            html = '<div style="font-size:12px; color:var(--text-sub); text-align:center; padding:10px;">ไม่มีรายการในหมวดนี้</div>';
        }
        const container = document.getElementById('custom-games-list');
        if (container) {
            container.innerHTML = html;
            container.querySelectorAll('[data-action="remove-custom"]').forEach(btn => btn.addEventListener('click', () => removeCustomGame(btn.dataset.key)));
        }
    });

    // Fetch and render Ignored Apps
    db.ref(`users/${uid}/ai_settings/ignored_games`).on('value', (snap) => {
        let html = '';
        if (snap.exists()) {
            const data = snap.val();
            for (let key in data) {
                let name = key.replace(/_exe$/i, '');
                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#292e39; border-radius:10px; margin-bottom:8px;">
                    <div style="font-size:13px; color:#fff;">${escapeHtml((name || '').replace(/\.exe/gi, '').replace(/_exe/gi, ''))}</div>
                    <button class="kill-btn" style="color:var(--red); border-color:var(--red); padding:4px 8px; font-size:12px; width:auto; border-radius:6px;" data-key="${escapeHtml(key)}" data-action="remove-ignored">ลบ</button>
                </div>`;
            }
        } else {
            html = '<div style="font-size:12px; color:var(--text-sub); text-align:center; padding:10px;">ไม่มีรายการในหมวดนี้</div>';
        }
        const container2 = document.getElementById('ignored-games-list');
        if (container2) {
            container2.innerHTML = html;
            container2.querySelectorAll('[data-action="remove-ignored"]').forEach(btn => btn.addEventListener('click', () => removeIgnoredGame(btn.dataset.key)));
        }
    });
};

window.closeGameManageModal = function(e) {
    if (e && e.target !== document.getElementById('game-manage-overlay')) return;
    document.getElementById('game-manage-overlay').classList.remove('show');
    document.body.style.overflow = '';
    
    // Stop listening
    const uid = auth.currentUser?.uid;
    if (uid) {
        db.ref(`users/${uid}/ai_settings/custom_games`).off('value');
        db.ref(`users/${uid}/ai_settings/ignored_games`).off('value');
    }
};

window.removeCustomGame = function(key) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    db.ref(`users/${uid}/ai_settings/custom_games/${key}`).remove().catch((err)=>{console.error(err);showToast('❌ ลบรายการไม่สำเร็จ','error');});
};

window.removeIgnoredGame = function(key) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    db.ref(`users/${uid}/ai_settings/ignored_games/${key}`).remove().catch((err)=>{console.error(err);showToast('❌ ลบรายการไม่สำเร็จ','error');});
};

// จับผลการตอบสนองปุ่มใช่หรือไม่
window._resolveSuspect = function (idx, isGame) {
    const n = _notifList[idx];
    if (!n || n.type !== 'suspect') return;

    const uid = n.suspect_uid;
    const suspectName = n.suspect_name;
    const safeKey = suspectName.toLowerCase().replace(/[.$#\[\]\/]/g, '_');

    if (isGame) {
        // ส่งอนุมัติข้อมูลผ่านทางระบบ Python เพื่อแสดงประวัติย้อนหลัง
        const gameName = suspectName.replace('.exe', '');
        // บันทึกรายละเอียดลงเป็นโหมดปรับแต่ง
        db.ref(`users/${uid}/ai_settings/custom_games/${safeKey}`).set(gameName);
        // นำคำร้องยืนยันไปยัง Python
        db.ref(`users/${uid}/gaming_mode/suspect_response`).set('confirm');
        n.resolved = 'yes';
        n.body = `จำไว้แล้วว่า ${gameName} เป็นเกม — แสดงข้อมูลทันที`;
        showToast(`✅ ระบบเรียนรู้แล้วว่า ${gameName} คือเกม!`);
    } else {
        // นำปฏิเสธคำสั่งไปยัง Python
        db.ref(`users/${uid}/ai_settings/ignored_games/${safeKey}`).set(true);
        db.ref(`users/${uid}/gaming_mode/suspect_response`).set('reject');
        n.resolved = 'no';
        n.body = `ลบข้อมูล ${suspectName} แล้ว`;
        showToast(`❌ ลบข้อมูลแล้ว`);
    }

    _saveNotifs();
    _renderNotifPanel();
};

// ดำเนินการการยืนยันจากรายการแอปเด่น
window.markAsGame = function (appName) {
    showConfirm({
        icon: '🤖',
        title: 'นี่คือเกมใช่ไหม?',
        body: `คุณต้องการให้ระบบจำว่า <b>${escapeHtml(appName)}</b> คือเกม และเริ่มคำนวณค่าไฟหรือไม่?`,
        confirmText: 'ใช่ นี่คือเกม',
        cancelText: 'ไม่ใช่',
        danger: false,
        onConfirm: () => {
            const uid = firebase.auth().currentUser?.uid;
            if (!uid) return;
            const safeKey = appName.toLowerCase().replace(/[.$#\[\]\/]/g, '_');
            const gameName = appName.replace('.exe', '');

            // จัดเก็บเป็นหมวดหมู่ AI เพื่อใช้อนาคต
            firebase.database().ref(`users/${uid}/ai_settings/custom_games/${safeKey}`).set(gameName);

            // ส่งคำสั่งให้ระบบประมวลผลยืนยัน
            firebase.database().ref(`users/${uid}/gaming_mode/suspect`).set({ name: appName });
            firebase.database().ref(`users/${uid}/gaming_mode/suspect_response`).set('confirm');

            showToast(`✅ เพิ่ม ${gameName} เป็นเกมแล้ว!`);
        },
        onCancel: () => {
            const uid = firebase.auth().currentUser?.uid;
            if (!uid) return;
            const safeKey = appName.toLowerCase().replace(/[.$#\[\]\/]/g, '_');

            // เพิกเฉยและตัดออกจากฐานของระบบ
            firebase.database().ref(`users/${uid}/ai_settings/ignored_games/${safeKey}`).set(true);

            // ตัดรอบให้ Python ยกเลิกกระบวนการสะสมรอบ
            firebase.database().ref(`users/${uid}/gaming_mode/suspect_response`).set('reject');
            firebase.database().ref(`users/${uid}/gaming_mode/suspect`).set(null);

            showToast(`❌ ลบการบันทึกลับของ ${appName} แล้ว`);
        }
    });
};

window.addNotification = function (icon, title, body, color) {
    color = color || "var(--text-main)";
    const now = new Date();
    const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    _notifList.unshift({ icon, title, body, color, time, read: false });
    _saveNotifs();
    _updateBellBadge();
    if (_notifPanelOpen) _renderNotifPanel();

    // ป้อนคิวเพื่อเป็นประวัติการแจ้งเตือน
    showBellPopup(icon, title, body, color);
};

window.toggleNotifPanel = function () {
    const panel = document.getElementById("notif-panel");
    if (!panel) return;
    _notifPanelOpen = !_notifPanelOpen;
    panel.style.display = _notifPanelOpen ? "flex" : "none";
    if (_notifPanelOpen) {
        _notifList.forEach(n => n.read = true);
        _saveNotifs();
        _updateBellBadge();
        _renderNotifPanel();
    }
};

window.clearNotifs = function () {
    _notifList = [];
    _saveNotifs();
    _updateBellBadge();
    _renderNotifPanel();
};

document.addEventListener("click", function (e) {
    const panel = document.getElementById("notif-panel");
    const bell = document.getElementById("notif-bell-btn");
    if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
        panel.style.display = "none";
        _notifPanelOpen = false;
    }
});

auth.onAuthStateChanged(function (userState2) {
    if (userState2) {
        const bell = document.getElementById("notif-bell-btn");
        if (bell) bell.style.display = "flex";
        _updateBellBadge();
    }
});

// การแก้ไขข้อผิดพลาด (Bug Fix) #12: โละลำดับฟังก์ชัน _onGamingStart, _onGamingStop ที่ไม่ได้ใช้งาน
// จัดรูปแบบแอนิเมชันใหม่และนำเข้าสู่โมดูล addNotification

// =====================================================
// ฟังก์ชันการสลับรูปแบบชุดสี (Theme Switcher)
// =====================================================
(() => {
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        // เข้าถึงหน่วยความจำเครื่อง และกำหนดเริ่มต้นค่า dark หากสูญข้อมูล
        const savedTheme = localStorage.getItem('recharge_theme') || 'glass';
        document.body.setAttribute('data-theme', savedTheme);
        themeSelector.value = savedTheme;

        // ตอบสนองเหตุการณ์การเปลี่ยนค่าเมื่อมีการปรับปรุง
        themeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('recharge_theme', newTheme);
        });
    }

    // นำเสนอกระบวนการทางเทคนิคแก้ปัญหากระตุกในเบื้องต้น
    const initialTheme = localStorage.getItem('recharge_theme') || 'glass';
    document.body.setAttribute('data-theme', initialTheme);
})();
