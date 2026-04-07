// ReCharge Premium — Main Application Script (Firebase Compat SDK)

// 🌟 ReCharge Premium — Main Application Script
// แยกออกจาก RE1.3.html เพื่อความสะอาดของโค้ด


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

// =====================================================
// ฟังก์ชันคำนวณและวาดเส้นสำหรับวิดเจ็ตวงกลม 2 ชั้น
// =====================================================
function updateDualRing(elementClass, radius, value, isTemp = false) {
    const circle = document.querySelector(`.${elementClass}`);
    if (!circle) return;

    const circumference = 2 * Math.PI * radius;

    // ป้องกันค่าเกิน 100 (สมมติอุณหภูมิเกิน 100 องศา ให้กราฟเต็มวงไปเลย)
    let percent = value > 100 ? 100 : value;

    const offset = circumference - (percent / 100) * circumference;

    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
}

// =====================================================
// 🎨 Custom Modal System (แทน browser confirm/alert)
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

// กด backdrop ปิด modal
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
    if (!uid) return;

    if (cmd === 'reset_uid') {
        showConfirm({
            icon: '⚠️',
            title: 'รีเซ็ต UID ?',
            body: 'โปรแกรมในคอมจะ:<br><br>' +
                '&nbsp;&nbsp;1. ลบ UID เก่าออก<br>' +
                '&nbsp;&nbsp;2. ปิดตัวเองอัตโนมัติ<br><br>' +
                '<span style="color:#f1c40f;">📌</span> หลังจากนั้น กรุณา<br>' +
                '<b>"ดับเบิ้ลคลิ้กเปิดโปรแกรม ReCharge"</b><br>เพื่อกรอก UID ใหม่',
            confirmText: 'ยืนยัน รีเซ็ต',
            cancelText: 'ยกเลิก',
            danger: true,
            onConfirm: () => {
                db.ref(`users/${uid}/PC_Control/command`).set(cmd).then(() => {
                    showResetUidBanner();
                });
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
        icon: info.icon,
        title: `สั่ง ${info.label} ?`,
        body: `ยืนยันสั่ง <b>${info.label}</b> คอมพิวเตอร์เลยไหมครับ?`,
        confirmText: `สั่ง ${info.label}`,
        danger: info.danger,
        onConfirm: () => {
            db.ref(`users/${uid}/PC_Control/command`).set(cmd).then(() => {
                showToast(`✅ ส่งคำสั่ง ${info.label} แล้ว!`);
            });
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
                โปรแกรมในคอมปิดตัวเองเรียบร้อยแล้ว<br>
                <span style="color: #f5f6fa; font-weight: 600;">กรุณาไปที่คอมพิวเตอร์</span><br>
                แล้ว <span style="color: #9b59b6; font-weight: 700;">ดับเบิ้ลคลิ้กเปิด recharge_sender.exe</span><br>
                เพื่อกรอก UID ใหม่
            </div>
            <div style="background: rgba(155,89,182,0.15); border: 1px solid rgba(155,89,182,0.4);
                        border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #a4b0be;
                        margin-bottom: 24px; text-align: left;">
                <div style="font-weight: 700; color: #9b59b6; margin-bottom: 6px;">📋 ขั้นตอน:</div>
                <div>1️⃣ ไปที่คอม → หาไฟล์ <b>recharge_sender.exe</b></div>
                <div>2️⃣ ดับเบิ้ลคลิ้กเปิดโปรแกรม</div>
                <div>3️⃣ กรอก UID ที่ปรากฏบนแอปนี้</div>
                <div>4️⃣ กด OK → โปรแกรมจะเชื่อมต่ออัตโนมัติ</div>
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
    if (!uid) return;
    showConfirm({
        icon: '📡',
        title: 'รีเซ็ต WiFi บอร์ด ESP32 ?',
        body: 'บอร์ดจะรีเซ็ตตัวเองเพื่อตั้งค่า WiFi ใหม่<br><span style="color:var(--red);">⚠️ บอร์ดจะออฟไลน์ชั่วคราว</span>',
        confirmText: 'รีเซ็ตบอร์ด',
        danger: true,
        onConfirm: () => {
            db.ref(`users/${uid}/PC_Monitor/Board_Command`).set(cmd).then(() => {
                showToast('📡 บอร์ดกำลังรีเซ็ตตัวเองครับ!');
            });
        }
    });
};

window.saveHardwareSetup = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const setupData = {
        fan_count: parseInt(document.getElementById('setup-fan').value) || 0,
        hdd_count: parseInt(document.getElementById('setup-hdd').value) || 0,
        ssd_count: parseInt(document.getElementById('setup-ssd').value) || 0,
        has_aio: document.getElementById('setup-aio').classList.contains('active'),
        unit_price: parseFloat(document.getElementById('setup-unit-price').value) || 4.5
    };
    db.ref(`users/${uid}/pc_setup`).set(setupData).then(() => showToast('✅ บันทึกสเปคและเรทค่าไฟเรียบร้อย!'));
};

document.getElementById('loginBtn').onclick = () => auth.signInWithPopup(provider);
document.getElementById('logoutBtn').onclick = () => auth.signOut().then(() => window.location.reload());

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('bottom-nav').style.display = 'flex';

        document.getElementById('uid-display').innerText = "UID: " + user.uid;
        document.getElementById('uid-display').classList.remove('skeleton-loader');

        const copyBtn = document.getElementById('copyUidBtn');
        copyBtn.style.display = 'flex';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(user.uid).then(() => {
                copyBtn.innerHTML = "<span class='material-symbols-rounded' style='font-size: 14px;'>check_circle</span> คัดลอกแล้ว";
                copyBtn.style.background = "var(--primary)";
                copyBtn.style.color = "#1e212b";
                setTimeout(() => {
                    copyBtn.innerHTML = "<span class='material-symbols-rounded' style='font-size: 14px;'>content_copy</span> คัดลอก";
                    copyBtn.style.background = "transparent";
                    copyBtn.style.color = "var(--primary)";
                }, 2000);
            }).catch(err => showToast('⚠️ กรุณาคลุมดำ UID แล้วคัดลอกเองครับ', 'error'));
        };

        let unitPrice = 4.5;
        let globalSessions = null;

        db.ref(`users/${user.uid}/pc_setup`).on('value', (snap) => {
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

        db.ref(`users/${user.uid}/PC_Monitor`).on('value', (snap) => {
            const d = snap.val();

            if (d) {
                // ตรวจ online=false เท่านั้น (Python ส่ง status="running" มาทุก update แล้ว)
                if (d.online === false) {
                    clearTimeout(offlineTimer);
                    document.getElementById('status-text').innerText = "• โปรแกรมปิดตัว — กรุณาเปิด .exe ใหม่";
                    document.getElementById('status-text').style.color = "var(--red)";
                    document.getElementById('status-dot').style.background = "var(--red)";
                    document.getElementById('status-dot').style.boxShadow = "0 0 10px var(--red)";
                    return;
                }

                clearTimeout(offlineTimer);
                document.getElementById('status-text').innerText = "• ออนไลน์เชื่อมต่อแล้ว";
                document.getElementById('status-text').style.color = "var(--primary)";
                document.getElementById('status-dot').style.background = "var(--primary)";
                document.getElementById('status-dot').style.boxShadow = "0 0 10px var(--primary)";

                let cpu_usage = d.CPU || 0;
                let cpu_temp = d.CPU_Temp || 0;
                let gpu_usage = d.GPU || 0;
                let gpu_temp = d.GPU_Temp || 0;
                let ram_usage = d.RAM || 0;

                // สำหรับ Storage ให้ใช้ Storage_C_Percent ถ้ามี หรือคำนวณจาก Free/Total (ตอนนี้จำลอง 50 ไปก่อนตามผู้ใช้)
                let storage_percent = 50;

                document.getElementById('val-cpu').innerText = cpu_usage;
                updateDualRing('cpu-usage-ring', 40, cpu_usage);
                updateDualRing('cpu-temp-ring', 25, cpu_temp, true);

                document.getElementById('val-gpu').innerText = gpu_usage;
                updateDualRing('gpu-usage-ring', 40, gpu_usage);
                updateDualRing('gpu-temp-ring', 25, gpu_temp, true);

                document.getElementById('val-ram').innerText = ram_usage;
                updateDualRing('ram-usage-ring', 40, ram_usage);

                const wattNow = Math.round(d.Watt || 0);
                document.getElementById('val-watt').innerText = wattNow + "W";
                document.getElementById('hw-avg-watt').innerText = `ตอนนี้ ${wattNow} W`;
                document.getElementById('bar-watt').style.width = Math.min((wattNow / 500) * 100, 100) + "%";

                let cpuTemp = d.CPU_Temp || 0;
                document.getElementById('val-cpu-temp').innerText = cpuTemp + "°C";
                document.getElementById('bar-cpu-temp').style.width = cpuTemp + "%";
                document.getElementById('bar-cpu-temp').style.background = cpuTemp > 80 ? "var(--red)" : "var(--primary)";

                document.getElementById('val-dl').innerText = (d.Net_DL_Mbps || 0).toFixed(2);
                document.getElementById('val-ul').innerText = (d.Net_UL_Mbps || 0).toFixed(2);
                document.getElementById('val-storage').innerText = (d.Storage_C_Free_GB || 0).toFixed(1);

                // 💡 แสดง AI Energy Insight
                const insightBanner = document.getElementById('insight-banner');
                const insightText = document.getElementById('insight-text');

                if (d.insight_wasted_baht > 0.5) {
                    insightBanner.style.display = 'flex';
                    insightText.innerHTML = `ตรวจพบการเปิดเครื่องทิ้งไว้โดยไม่ใช้งาน <b>${(d.insight_idle_mins / 60).toFixed(1)} ชม.</b><br>สูญเสียค่าไฟไปแล้วประมาณ <b style="color:var(--red);">฿${d.insight_wasted_baht.toFixed(2)}</b><br><span style="color:var(--text-sub); font-size:11px;">📌 คำแนะนำ: หากไม่ได้ใช้งานต่อ กรุณาสั่ง Sleep หรือปิดเครื่องเพื่อประหยัดพลังงาน</span>`;
                } else {
                    insightBanner.style.display = 'none';
                }

                // Battery (แสดงเฉพาะเมื่อ != 100% หรือไม่ได้เสียบปลั๊ก)
                const batPct = d.Battery_Percent;
                if (batPct != null && batPct < 100) {
                    const batCard = document.getElementById('battery-card');
                    batCard.style.display = 'block';
                    document.getElementById('val-battery').innerText = batPct + '%';
                    document.getElementById('hw-battery-status').innerText = d.Is_Plugged ? '🔌 กำลังชาร์จ' : '🔋 ใช้แบตเตอรี่';
                    document.getElementById('hw-battery-status').classList.remove('skeleton-loader');
                    const bar = document.getElementById('bar-battery');
                    bar.style.width = batPct + '%';
                    bar.style.background = batPct < 20 ? 'var(--red)' : batPct < 50 ? 'var(--yellow)' : 'var(--primary)';
                }

                // ⏳ อัปเดตตัวเลขเวลานับถอยหลัง
                if (d.Timer_Left_Secs != null && d.Timer_Left_Secs > 0) {
                    document.getElementById('timer-display').style.display = 'block';
                    let m = Math.floor(d.Timer_Left_Secs / 60);
                    let s = d.Timer_Left_Secs % 60;
                    document.getElementById('timer-countdown').innerText =
                        `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                } else {
                    document.getElementById('timer-display').style.display = 'none';
                }

                if (d.Top_Apps && d.Top_Apps.length > 0) {
                    let appsHtml = "";
                    d.Top_Apps.forEach(app => {
                        let bellHtml = '';
                        if (app.cpu >= 6.5 || (app.ram_gb && app.ram_gb >= 1.0)) {
                            bellHtml = `<button class="kill-btn" style="color:var(--yellow); border-color:var(--yellow); margin-right:5px;" title="นี่คือเกมใช่ไหม?" onclick="markAsGame('${app.name}')"><span class="material-symbols-rounded">notifications</span></button>`;
                        }
                        const ramText = app.ram_gb !== undefined ? ` | <span style="font-size:11px; color:var(--text-sub);">${app.ram_gb.toFixed(1)}GB</span>` : '';
                        appsHtml += `
                        <div class="top-app-item">
                            <div class="top-app-name"><span class="material-symbols-rounded" style="font-size:16px;">terminal</span> ${app.name}</div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="top-app-cpu">${app.cpu}%${ramText}</div>
                                <div style="display:flex;">
                                    ${bellHtml}
                                    <button class="kill-btn" title="Force Close ${app.name}" onclick="killProcess('${app.name}')">
                                        <span class="material-symbols-rounded">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    });
                    document.getElementById('top-apps-container').innerHTML = appsHtml;
                } else {
                    document.getElementById('top-apps-container').innerHTML = '<div style="font-size: 12px; color: var(--text-sub); text-align: center;">ไม่มีโปรแกรมสูบ CPU ในขณะนี้</div>';
                }

                if (d.Top_RAM_Apps && d.Top_RAM_Apps.length > 0) {
                    let ramHtml = "";
                    d.Top_RAM_Apps.forEach(app => {
                        let bellHtml = '';
                        // แสดงกระดิ่งถ้า CPU >= 6.5 หรือ RAM >= 1.0GB
                        if (app.cpu >= 6.5 || (app.ram_gb && app.ram_gb >= 1.0)) {
                            bellHtml = `<button class="kill-btn" style="color:var(--yellow); border-color:var(--yellow); margin-right:5px;" title="นี่คือเกมใช่ไหม?" onclick="markAsGame('${app.name}')"><span class="material-symbols-rounded">notifications</span></button>`;
                        }
                        ramHtml += `
                        <div class="top-app-item">
                            <div class="top-app-name"><span class="material-symbols-rounded" style="font-size:16px;">terminal</span> ${app.name}</div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="top-app-cpu"><span style="font-size:11px; opacity:0.7">${app.cpu}%</span> | ${app.ram_gb.toFixed(1)}GB</div>
                                <div style="display:flex;">
                                    ${bellHtml}
                                    <button class="kill-btn" title="Force Close ${app.name}" onclick="killProcess('${app.name}')">
                                        <span class="material-symbols-rounded">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    });
                    document.getElementById('top-ram-apps-container').innerHTML = ramHtml;
                } else {
                    if (document.getElementById('top-ram-apps-container')) {
                        document.getElementById('top-ram-apps-container').innerHTML = '<div style="font-size: 12px; color: var(--text-sub); text-align: center;">ไม่มีโปรแกรมสูบ RAM ในขณะนี้</div>';
                    }
                }

                offlineTimer = setTimeout(() => {
                    document.getElementById('status-text').innerText = "• ออฟไลน์ (ปิดเครื่อง/โปรแกรมหยุดทำงาน)";
                    document.getElementById('status-text').style.color = "var(--red)";
                    document.getElementById('status-dot').style.background = "var(--red)";
                    document.getElementById('status-dot').style.boxShadow = "0 0 10px var(--red)";
                }, 15000);
            }
        });

        db.ref(`users/${user.uid}/hardware_info`).on('value', (snap) => {
            if (snap.val()) {
                const hw = snap.val();
                document.getElementById('hw-cpu-name').innerText = hw.cpu_model || '–';
                document.getElementById('hw-cpu-cores').innerText = `GPU: ${hw.gpu_model || '–'} | จอ ${hw.monitor_count || 1} จอ`;
                document.getElementById('pc-name-display').innerText = (hw.os || 'Windows') + " PC";
                document.getElementById('hw-cpu-cores').classList.remove('skeleton-loader');
                document.getElementById('pc-name-display').classList.remove('skeleton-loader');
            }
        });

        // =====================================================
        // 🎯 Feature 1: Remote Task Killer — รับ kill_result
        // =====================================================
        window.killProcess = (processName) => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            showConfirm({
                icon: '⚡',
                title: `Force Close ?`,
                body: `ปิด <b>"${processName}"</b> เลยไหมครับ?<br><span style="color:var(--red); font-size:12px;">โปรแกรมจะถูกปิดทันทีโดยไม่บันทึก</span>`,
                confirmText: 'Force Close',
                danger: true,
                onConfirm: () => {
                    db.ref(`users/${uid}/PC_Control/command`).set(`kill:${processName}`)
                        .then(() => showKillToast(`⏳ กำลังปิด ${processName}...`, 'var(--yellow)'));
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
        // 🎯 Feature 2: Gaming Mode — ติดตาม gaming_mode node
        // =====================================================
        let _lastGameEndKey = '';  // BUG FIX: ป้องกัน toast ซ้ำตอนโหลดหน้า

        db.ref(`users/${user.uid}/gaming_mode`).on('value', (snap) => {
            const g = snap.val();
            const banner = document.getElementById('gaming-banner');
            const wattEl = document.getElementById('gaming-watt');

            if (g && g.active) {
                document.body.classList.add('gaming-active');
                banner.classList.add('active');
                document.getElementById('gaming-game-name').innerText = g.game || 'Unknown Game';
                let tM = g.session_mins || 0;
                document.getElementById('gaming-mins').innerText = `${Math.floor(tM / 60)}.${Math.floor(tM % 60).toString().padStart(2, '0')}`;
                document.getElementById('gaming-cost').innerText = g.cost_thb != null ? Number(g.cost_thb).toFixed(2) : '0.00';
                const wattNow = document.getElementById('val-watt').innerText;
                if (wattEl) wattEl.innerText = wattNow;
                _lastGameEndKey = '';  // รีเซ็ตเมื่อเริ่มเกมใหม่
            } else {
                document.body.classList.remove('gaming-active');
                banner.classList.remove('active');
                // BUG FIX: ป้องกัน toast ซ้ำ — ใช้ last_game+last_mins เป็น key
                if (g && !g.active && g.last_game) {
                    const endKey = `${g.last_game}_${g.last_mins}`;
                    if (endKey !== _lastGameEndKey) {
                        _lastGameEndKey = endKey;
                        showAlertToast(
                            'cost', '🎮',
                            `จบเกม: ${g.last_game}`,
                            `เล่น ${g.last_mins} นาที — ค่าไฟที่สูบ ฿${Number(g.last_cost_thb).toFixed(2)}`
                        );
                    }
                }
            }
        });

        // =====================================================
        // 🎯 Feature 3: Smart Alerts — แสดง toast เมื่อ Python เขียนเตือน
        // =====================================================
        let _lastAlertCpuTime = '', _lastAlertCostTime = '';

        function showAlertToast(type, icon, title, body) {
            const container = document.getElementById('alert-container');
            const div = document.createElement('div');
            div.className = `alert-toast ${type}`;
            div.innerHTML = `
                <div class="alert-toast-icon">${icon}</div>
                <div style="flex:1;">
                    <div class="alert-toast-title" style="color:${type === 'cpu' ? 'var(--red)' : 'var(--yellow)'};">${title}</div>
                    <div class="alert-toast-body">${body}</div>
                </div>
                <button class="alert-close" onclick="this.parentElement.remove()">✕</button>`;
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
        // 🤖 AI Smart Game Discovery — แจ้งเตือนที่กระดิ่งเท่านั้น (ไม่มี popup)
        // =====================================================
        let lastSuspect = null;
        db.ref(`users/${user.uid}/gaming_mode/suspect`).on('value', (snap) => {
            const suspect = snap.val();
            if (!suspect || !suspect.name) return;
            if (lastSuspect === suspect.name) return;

            // ถ้ากำลังอยู่ในโหมดเกมอยู่แล้ว ไม่ต้องถาม
            if (document.body.classList.contains('gaming-active')) return;
            lastSuspect = suspect.name;

            // 🔔 แจ้งเตือนที่กระดิ่งซ่อนไว้เงียบๆ (เผื่อผู้ใช้มากดดูภายหลัง)
            window.addSuspectNotification(user.uid, {
                name: suspect.name,
                cpu_pct: suspect.cpu_pct,
                ram_gb: suspect.ram_gb,
                detected_at: suspect.detected_at
            });
        });

        // 🌟 ระบบดึงประวัติตามวันที่เลือก (Time Machine)
        let historyUnsubscribe = null;

        function fetchHistoryByDate(dateStr) {
            if (historyUnsubscribe) historyUnsubscribe();

            const startOfDay = dateStr + " 00:00:00";
            const endOfDay = dateStr + " 23:59:59";

            const historyQuery = db.ref(`users/${user.uid}/history_logs`).orderByChild("timestamp").startAt(startOfDay).endAt(endOfDay);

            historyUnsubscribe = historyQuery.on('value', (snap) => {
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
                            <div class="top-app-name"><span class="material-symbols-rounded" style="font-size:16px;">apps</span> ${app.name}</div>
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
            });
        }

        // 🌟 ตั้งค่าเริ่มต้นให้ปฏิทินเป็น "วันนี้"
        const todayNow = new Date();
        const todayStrFormat = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, '0')}-${String(todayNow.getDate()).padStart(2, '0')}`;
        const datePicker = document.getElementById('history-date-picker');
        datePicker.value = todayStrFormat;

        fetchHistoryByDate(todayStrFormat);

        datePicker.addEventListener('change', (e) => {
            fetchHistoryByDate(e.target.value);
        });

        // ===============================================
        // ⚡ Real-time today ticker (วิ่งเหมือน CPU/GPU)
        // ===============================================
        const now2 = new Date();
        const todayStr2 = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-${String(now2.getDate()).padStart(2, '0')}`;
        const monthStr2 = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;

        let _dailyBaseMins = 0, _dailyBaseCost = 0, _dailyBaseTs = Date.now();
        let _todayTickInterval = null;

        function _tickTodayDisplay() {
            const elapsedMins = (Date.now() - _dailyBaseTs) / 60000;
            const totalMins = Math.round(_dailyBaseMins + elapsedMins);
            const elapsedHrs = elapsedMins / 60;
            const currentWatt = parseFloat(document.getElementById('hw-avg-watt')?.innerText?.replace(/[^\d.]/g, '')) || 0;
            const addedCost = (currentWatt / 1000) * elapsedHrs * unitPrice;
            const totalCost = _dailyBaseCost + addedCost;
            document.getElementById('timeTodayVal').innerText = `${Math.floor(totalMins / 60)}.${Math.floor(totalMins % 60).toString().padStart(2, '0')}`;
            document.getElementById('costTodayVal').innerText = totalCost.toFixed(2);
        }

        // เมื่อ daily_summary อัปเดต (ทุก 5 นาทีจาก Python) → รีเซ็ต base
        db.ref(`users/${user.uid}/daily_summary/${todayStr2}`).on('value', (snap) => {
            const d = snap.val();
            _dailyBaseMins = d ? (d.session_mins || 0) : 0;
            _dailyBaseCost = d ? (d.cost_thb || 0) : 0;
            _dailyBaseTs = Date.now();
            _tickTodayDisplay();

            if (_todayTickInterval) clearInterval(_todayTickInterval);
            _todayTickInterval = setInterval(_tickTodayDisplay, 5000);
        });

        // ค่าไฟเดือนนี้ → monthly_summary (เหมือนหน้าสรุปรายปี ✅)
        db.ref(`users/${user.uid}/monthly_summary/${monthStr2}`).on('value', (snap) => {
            const m = snap.val();
            document.getElementById('costMonthVal').innerText = m ? Number(m.total_cost_thb || 0).toFixed(2) : '0.00';
            let mTm = m ? (m.total_session_mins || 0) : 0;
            document.getElementById('timeMonthVal').innerText = `${Math.floor(mTm / 60)}.${Math.floor(mTm % 60).toString().padStart(2, '0')}`;
        });

    }
});

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
    let html = '';
    sorted.forEach(g => {
        const hrs = Math.floor(g.total_mins / 60);
        const mins = Math.round(g.total_mins % 60);
        const timeStr = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
        html += `<div class="game-log-card">
            <div class="game-log-title">
                <span>🎮 ${g.name || g}</span>
                <span class="game-log-mins">${timeStr}</span>
            </div>
            <div class="game-log-sub">ค่าไฟ ฿${Number(g.total_cost_thb || 0).toFixed(4)}</div>`;
        if (g.sessions && g.sessions.length > 0) {
            g.sessions.forEach(s => {
                html += `<div class="game-row">
                    <div class="game-row-name"><span class="material-symbols-rounded" style="font-size:14px;">schedule</span> ${s.start} – ${s.end}</div>
                    <div class="game-row-mins">${s.mins} นาที</div>
                </div>`;
            });
        }
        html += '</div>';
    });
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

    db.ref(`users/${uid}/daily_game_log`).once('value').then(snap => {
        const allDays = snap.val();
        if (!allDays) return;
        const daysInMonth = Object.keys(allDays).filter(d => d.startsWith(monthStr)).sort().reverse();
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
                    <div style="font-size:10px; color:var(--text-sub);">${gameNames}</div>
                </div>
            </div>`;
        });
        if (daysHtml) {
            document.getElementById('gaming-days-list').innerHTML = `<div class="card" style="padding:14px;">${daysHtml}</div>`;
        }
    });
}

// =====================================================
// 📊 Monthly Summary + Yearly Summary
// =====================================================
function initYearSelect() {
    const sel = document.getElementById('year-select');
    const thisYear = new Date().getFullYear();
    sel.innerHTML = '';
    for (let y = thisYear; y >= thisYear - 3; y--) {
        const opt = document.createElement('option');
        opt.value = y; opt.text = y + ' ปี';
        if (y === thisYear) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.addEventListener('change', () => loadYearlySummary(parseInt(sel.value)));
}

function loadYearlySummary(year) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    document.getElementById('year-label').innerText = year;
    document.getElementById('summary-loading').style.display = 'block';
    document.getElementById('monthly-summary-list').innerHTML = '';
    document.getElementById('year-total-bar').style.display = 'none';

    db.ref(`users/${uid}/monthly_summary`).once('value').then(snap => {
        document.getElementById('summary-loading').style.display = 'none';
        const allMonths = snap.val();
        if (!allMonths) {
            document.getElementById('monthly-summary-list').innerHTML =
                '<div style="text-align:center;padding:30px;color:var(--text-sub);font-size:13px;">ยังไม่มีข้อมูลสรุปรายเดือน<br><small>ข้อมูลจะเริ่มสะสมหลังโปรแกรม Python รันครบ 1 ชม.</small></div>';
            return;
        }
        const months = Object.entries(allMonths)
            .filter(([k]) => k.startsWith(String(year)))
            .sort((a, b) => b[0].localeCompare(a[0]));

        if (months.length === 0) {
            document.getElementById('monthly-summary-list').innerHTML =
                `<div style="text-align:center;padding:30px;color:var(--text-sub);font-size:13px;">ไม่มีข้อมูลปี ${year}</div>`;
            return;
        }

        let yrHrs = 0, yrCost = 0, yrKwh = 0, yrGame = 0, yrCpuSum = 0, yrRamSum = 0;
        let html = '';
        months.forEach(([monthKey, m]) => {
            yrHrs += m.total_session_hrs || 0;
            yrCost += m.total_cost_thb || 0;
            yrKwh += m.total_kwh || 0;
            yrGame += m.game_hrs || 0;
            yrCpuSum += m.avg_cpu || 0;
            yrRamSum += m.avg_ram || 0;

            const topApps = Object.entries(m.top_apps_count || {})
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([name]) => `<span class="ym-app-chip">${name.replace('.exe', '')}</span>`).join('');

            const monthName = new Date(monthKey + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            html += `<div class="year-month-card">
                <div class="ym-header">
                    <div class="ym-month">📅 ${monthName}</div>
                    <div class="ym-cost">฿${Number(m.total_cost_thb || 0).toFixed(2)}</div>
                </div>
                <div class="ym-stats-grid">
                    <div class="ym-stat">
                        <div class="ym-stat-val" style="color:var(--primary);">${m.total_session_hrs || 0}<small style="font-size:11px;"> ชม.</small></div>
                        <div class="ym-stat-label">ใช้งาน</div>
                    </div>
                    <div class="ym-stat">
                        <div class="ym-stat-val" style="color:var(--red);">${m.game_hrs || 0}<small style="font-size:11px;"> ชม.</small></div>
                        <div class="ym-stat-label">เล่นเกม</div>
                    </div>
                    <div class="ym-stat">
                        <div class="ym-stat-val" style="color:var(--yellow);">${m.total_kwh || 0}<small style="font-size:11px;"> kWh</small></div>
                        <div class="ym-stat-label">พลังงาน</div>
                    </div>
                    <div class="ym-stat">
                        <div class="ym-stat-val" style="color:var(--blue);">${m.avg_cpu || 0}<small style="font-size:11px;">%</small></div>
                        <div class="ym-stat-label">avg CPU</div>
                    </div>
                    <div class="ym-stat">
                        <div class="ym-stat-val" style="color:var(--yellow);">${m.avg_ram || 0}<small style="font-size:11px;">%</small></div>
                        <div class="ym-stat-label">avg RAM</div>
                    </div>
                    <div class="ym-stat">
                        <div class="ym-stat-val" style="color:var(--purple);">${m.avg_watt || 0}<small style="font-size:11px;">W</small></div>
                        <div class="ym-stat-label">avg Watt</div>
                    </div>
                </div>
                ${topApps ? `<div class="ym-apps">${topApps}</div>` : ''}
            </div>`;
        });

        document.getElementById('monthly-summary-list').innerHTML = html;

        const n = months.length;
        document.getElementById('yr-total-hrs').innerText = yrHrs.toFixed(1) + ' ชม.';
        document.getElementById('yr-total-cost').innerText = '฿' + yrCost.toFixed(2);
        document.getElementById('yr-total-kwh').innerText = yrKwh.toFixed(2) + ' kWh';
        document.getElementById('yr-total-game').innerText = yrGame.toFixed(1) + ' ชม.';
        document.getElementById('yr-avg-cpu').innerText = (yrCpuSum / n).toFixed(1) + '%';
        document.getElementById('yr-avg-ram').innerText = (yrRamSum / n).toFixed(1) + '%';
        document.getElementById('year-total-bar').style.display = 'block';
    }).catch(() => {
        document.getElementById('summary-loading').style.display = 'none';
        document.getElementById('monthly-summary-list').innerHTML =
            '<div style="text-align:center;padding:20px;color:var(--red);">โหลดข้อมูลไม่สำเร็จ</div>';
    });
}

// init gaming tab date picker
const gamingDatePicker = document.getElementById('gaming-date-picker');
if (gamingDatePicker) {
    const todayD = new Date();
    const todayDS = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;
    gamingDatePicker.value = todayDS;
    gamingDatePicker.addEventListener('change', (e) => {
        if (document.getElementById('toggle-daily').classList.contains('active')) {
            loadDailyGameLog(e.target.value);
        }
    });
}

// โหลดอัตโนมัติเมื่อ switch ไป tab history
let _yearlyLoaded = false;
const origSwitchTab = window.switchTab;
window.switchTab = (tabId, element) => {
    origSwitchTab(tabId, element);
    if (tabId === 'history') {
        const isDaily = document.getElementById('toggle-daily').classList.contains('active');
        if (isDaily) loadDailyGameLog(document.getElementById('gaming-date-picker').value);
        else loadMonthlyGameLog();
        if (!_yearlyLoaded) {
            _yearlyLoaded = true;
            initYearSelect();
            loadYearlySummary(new Date().getFullYear());
        }
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
    const mins = document.getElementById('timer-mins').value;
    const uid = auth.currentUser?.uid;
    if (!uid || !mins || mins <= 0) return;
    showConfirm({
        icon: '⏳',
        title: `ตั้งเวลาปิดเครื่อง`,
        body: `ยืนยันตั้งเวลาปิดเครื่องในอีก <b>${mins} นาที</b> ใช่ไหมครับ?`,
        confirmText: 'เริ่มจับเวลา',
        onConfirm: () => {
            db.ref(`users/${uid}/PC_Control/command`).set(`timer:${mins}`);
            showToast(`⏳ ตั้งเวลาปิดเครื่องใน ${mins} นาทีแล้ว`);
        }
    });
};

window.cancelTimer = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    db.ref(`users/${uid}/PC_Control/command`).set(`timer:cancel`);
};

// =====================================================
// 🔔 ระบบกระดิ่งแจ้งเตือนภายในแอป (In-App Notifications)
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
        // 🎮 ถ้าเป็น notification แบบ suspect → แสดงปุ่ม "ใช่ / ไม่ใช่"
        let actionsHtml = '';
        if (n.type === 'suspect' && !n.resolved) {
            actionsHtml = `
                <div style="display:flex;gap:8px;margin-top:8px;">
                    <button onclick="window._resolveSuspect(${idx}, true)" style="flex:1;padding:6px 0;border:none;border-radius:8px;background:var(--primary);color:#1e212b;font-size:11px;font-weight:700;font-family:'Prompt';cursor:pointer;">ใช่, เป็นเกม</button>
                    <button onclick="window._resolveSuspect(${idx}, false)" style="flex:1;padding:6px 0;border:none;border-radius:8px;background:rgba(231,76,60,.2);color:var(--red);font-size:11px;font-weight:700;font-family:'Prompt';cursor:pointer;">ไม่ใช่</button>
                </div>`;
        } else if (n.type === 'suspect' && n.resolved) {
            actionsHtml = `<div style="font-size:10px;color:var(--text-sub);margin-top:4px;font-style:italic;">${n.resolved === 'yes' ? '✅ จำไว้แล้วว่าเป็นเกม' : '❌ ลบข้อมูลแล้ว'}</div>`;
        }

        return `<div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.05);${!n.read ? 'background:rgba(32,201,151,.04)' : ''}">
            <div style="display:flex;gap:10px;">
                <div style="font-size:22px;flex-shrink:0">${n.icon}</div>
                <div style="flex:1">
                    <div style="font-size:12px;font-weight:700;color:${n.color || 'var(--text-main)'}">${n.title}</div>
                    <div style="font-size:11px;color:var(--text-sub);margin-top:2px">${n.body}</div>
                    <div style="font-size:10px;color:var(--text-sub);margin-top:4px;opacity:.6">${n.time}</div>
                    ${actionsHtml}
                </div>
                ${!n.read ? '<div style="width:7px;height:7px;background:var(--primary);border-radius:50%;flex-shrink:0;margin-top:4px"></div>' : ''}
            </div>
        </div>`;
    }).join("");
}

function showBellPopup(icon, title, body, color) {
    // สร้าง popup เล็กๆ ลอยลงมาจากกระดิ่ง
    const popup = document.createElement('div');
    popup.style.cssText = `
                position: fixed; top: 70px; right: 170px; z-index: 9999;
                background: ${color || 'var(--bg-card)'}; border: var(--card-border);
                border-radius: 12px; padding: 12px 16px; min-width: 250px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                display: flex; gap: 12px; align-items: flex-start;
                animation: slideToast 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                color: #fff;
            `;
    // ถ้าเป็นสี var(--bg-card) ให้เป็นสีพื้นฐาน ถ้าเป็น var(--red) ให้เปลี่ยนสีพื้นเพื่อเตือน
    if (color && color.includes('var(')) {
        popup.style.background = 'var(--bg-card)';
        popup.style.borderLeft = `4px solid ${color}`;
    }

    popup.innerHTML = `
                <div style="font-size: 24px; flex-shrink: 0; line-height: 1;">${icon}</div>
                <div>
                    <div style="font-size: 13px; font-weight: 700; color: ${color || 'var(--text-main)'};">${title}</div>
                    <div style="font-size: 11px; color: var(--text-sub); margin-top: 2px;">${body}</div>
                </div>
            `;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.animation = 'slideToast 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) reverse';
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 400);
    }, 5000); // ให้อยู่ 5 วินาที
}

// 🎮 Suspect Notification — แจ้งเตือนที่กระดิ่งพร้อมปุ่ม action
window.addSuspectNotification = function (uid, suspectData) {
    const now = new Date();
    const time = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    _notifList.unshift({
        type: 'suspect',
        icon: '🤖',
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
};

// 🎮 กดปุ่ม "ใช่/ไม่ใช่" ในแผงกระดิ่ง
window._resolveSuspect = function (idx, isGame) {
    const n = _notifList[idx];
    if (!n || n.type !== 'suspect') return;

    const uid = n.suspect_uid;
    const suspectName = n.suspect_name;
    const safeKey = suspectName.toLowerCase().replace(/[.$#\[\]\/]/g, '_');
    const db = firebase.database();

    if (isGame) {
        // ✅ บอก Python ว่าใช่เกม → Python จะย้ายข้อมูลที่นับลับๆ มาแสดงทันที
        const gameName = suspectName.replace('.exe', '');
        // 1. บันทึกเป็น custom game (ครั้งหน้าจะได้จำทันที)
        db.ref(`users/${uid}/ai_settings/custom_games/${safeKey}`).set(gameName);
        // 2. ส่งคำสั่ง confirm ไป Python → Python จะย้าย pending data มาแสดง
        db.ref(`users/${uid}/gaming_mode/suspect_response`).set('confirm');
        n.resolved = 'yes';
        n.body = `จำไว้แล้วว่า ${gameName} เป็นเกม — แสดงข้อมูลทันที`;
        showToast(`✅ ระบบเรียนรู้แล้วว่า ${gameName} คือเกม!`);
    } else {
        // ❌ ส่งคำสั่ง reject ไป Python → Python จะลบข้อมูลลับทิ้งทั้งหมด
        db.ref(`users/${uid}/ai_settings/ignored_games/${safeKey}`).set(true);
        db.ref(`users/${uid}/gaming_mode/suspect_response`).set('reject');
        n.resolved = 'no';
        n.body = `ลบข้อมูล ${suspectName} แล้ว`;
        showToast(`❌ ลบข้อมูลแล้ว`);
    }

    _saveNotifs();
    _renderNotifPanel();
};

// 🎮 กดกระดิ่งใน Top Apps เพื่อยืนยันว่าเป็นเกมหรือไม่
window.markAsGame = function (appName) {
    showConfirm({
        icon: '🤖',
        title: 'นี่คือเกมใช่ไหม?',
        body: `คุณต้องการให้ระบบจำว่า <b>${appName}</b> คือเกม และเริ่มคำนวณค่าไฟหรือไม่?`,
        confirmText: 'ใช่ นี่คือเกม',
        cancelText: 'ไม่ใช่',
        danger: false,
        onConfirm: () => {
            const uid = firebase.auth().currentUser?.uid;
            if (!uid) return;
            const safeKey = appName.toLowerCase().replace(/[.$#\[\]\/]/g, '_');
            const gameName = appName.replace('.exe', '');

            // ให้ AI จำไว้เลยในอนาคต
            firebase.database().ref(`users/${uid}/ai_settings/custom_games/${safeKey}`).set(gameName);

            // ส่งไปบอก Python ให้คอนเฟิร์ม (เผื่อ Python จับ pending ไว้แล้ว)
            firebase.database().ref(`users/${uid}/gaming_mode/suspect`).set({ name: appName });
            firebase.database().ref(`users/${uid}/gaming_mode/suspect_response`).set('confirm');

            showToast(`✅ เพิ่ม ${gameName} เป็นเกมแล้ว!`);
        },
        onCancel: () => {
            const uid = firebase.auth().currentUser?.uid;
            if (!uid) return;
            const safeKey = appName.toLowerCase().replace(/[.$#\[\]\/]/g, '_');

            // ลืมไปเลย
            firebase.database().ref(`users/${uid}/ai_settings/ignored_games/${safeKey}`).set(true);

            // สั่งให้ python ยกเลิกที่แอบนับ
            firebase.database().ref(`users/${uid}/gaming_mode/suspect_response`).set('reject');

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

    // แจ้งเตือนแบบ In-App Popup โผล่ตรงกระดิ่ง
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

// 🎮 Gaming notification hooks
let _lastGameNotifKey = "";
window._onGamingStart = function (gameName) {
    if (gameName === _lastGameNotifKey) return;
    _lastGameNotifKey = gameName;
    window.addNotification("🎮", `เริ่มเล่น: ${gameName}`, "แอปพลิเคชันเข้าสู่โหมดเกมมิ่งเรียบร้อยแล้ว", "var(--red)");
};
window._onGamingStop = function (lastGame, lastMins, lastCost) {
    _lastGameNotifKey = "";
    if (lastGame) {
        window.addNotification("🏁", `จบเกม: ${lastGame}`, `ใช้เวลา ${lastMins} นาที — ค่าไฟ ฿${Number(lastCost || 0).toFixed(2)}`, "var(--yellow)");
    }
};

// =====================================================
// 🎨 ระบบ Theme Switcher (UI)
// =====================================================
(() => {
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        // ดึงค่าธีมเดิมจาก Local Storage ถ้าไม่มีให้ใช้ dark
        const savedTheme = localStorage.getItem('recharge_theme') || 'dark';
        document.body.setAttribute('data-theme', savedTheme);
        themeSelector.value = savedTheme;

        // ดักเหตุการณ์เมื่อผู้ใช้เลือกธีมใหม่
        themeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('recharge_theme', newTheme);
        });
    }

    // ตั้งค่าธีมตอนโหลดหน้าแรกก่อนที่สคริปต์จะหา selector เจอ (กันกระตุก)
    const initialTheme = localStorage.getItem('recharge_theme') || 'dark';
    document.body.setAttribute('data-theme', initialTheme);
})();
