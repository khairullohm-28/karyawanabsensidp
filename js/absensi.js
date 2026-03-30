/**
 * Portal Karyawan - Absensi
 * Attendance/Clock In-Out functionality - FULLY FIXED
 */

const absensi = {
    currentState: 'waiting',
    attendanceData: {},
    liveClockInterval: null,

    async init() {
        console.log('🎯 Absensi init...');
        await this.loadTodayAttendance();
        await this.loadAttendanceHistory();
        console.log('📊 State:', this.currentState);
        console.log('📋 Data:', this.attendanceData);
        
        this.initLiveClock();
        this.initButtons();
        this.renderTimeline();
        this.updateUI();

        setTimeout(() => {
            const btn = document.getElementById('btn-clock-in');
            console.log('🔧 Btn exists:', !!btn);
            console.log('🔧 Btn disabled:', btn?.disabled);
        }, 1000);
    },

    async loadTodayAttendance() {
        const currentUser = auth.getCurrentUser();
        const userId = currentUser?.id || 'demo-user';

        try {
            const [result] = await Promise.all([
                api.getTodayAttendance(userId)
            ]);

            let todayAttendance = result?.data || {};

            if (!todayAttendance.date) {
                const today = dateTime.getLocalDate();
                const currentShift = currentUser?.shift || 'Pagi';
                todayAttendance = {
                    date: today,
                    shift: currentShift,
                    clockIn: null,
                    clockOut: null,
                    breakStart: null,
                    breakEnd: null,
                    overtimeStart: null,
                    status: 'waiting',
                    verificationPhoto: '',
                    verificationLocation: '',
                    verificationTimestamp: ''
                };
            }

            todayAttendance.clockIn = todayAttendance.clockIn || null;
            todayAttendance.clockOut = todayAttendance.clockOut || null;
            todayAttendance.breakStart = todayAttendance.breakStart || null;
            todayAttendance.breakEnd = todayAttendance.breakEnd || null;
            todayAttendance.overtimeStart = todayAttendance.overtimeStart || null;

            this.attendanceData = todayAttendance;

            if (todayAttendance.shift === 'Libur' && !todayAttendance.clockIn) {
                this.currentState = 'libur';
            } else if (todayAttendance.clockOut) {
                this.currentState = 'completed';
            } else if (todayAttendance.breakStart && !todayAttendance.breakEnd) {
                this.currentState = 'on-break';
            } else if (todayAttendance.clockIn) {
                this.currentState = 'clocked-in';
            } else {
                this.currentState = 'waiting';
            }

            console.log('✅ Today attendance loaded');
        } catch (error) {
            console.error('❌ Load attendance error:', error);
        }
    },

    async loadAttendanceHistory() {
        try {
            const result = await api.getAllAttendance();
            const allData = result.data || [];
            const currentUser = auth.getCurrentUser();
            const userId = currentUser?.id || 'demo-user';
            const historyData = allData.filter(d => String(d.userId) === String(userId));
            this.renderHistory(historyData);
        } catch (error) {
            console.error('❌ History error:', error);
        }
    },

    renderHistory(historyData) {
        const tbody = document.getElementById('attendance-history');
        if (!tbody) return;

        if (historyData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Belum ada riwayat absensi.</td></tr>';
            return;
        }

        tbody.innerHTML = historyData.slice(0, 10).map(record => {
            let duration = '--';
            if (record.clockIn && record.clockOut) {
                const [inH, inM] = record.clockIn.split(':').map(Number);
                const [outH, outM] = record.clockOut.split(':').map(Number);
                let diffInMinutes = (outH * 60 + outM) - (inH * 60 + inM);
                if (record.breakStart && record.breakEnd) {
                    const [bInH, bInM] = record.breakStart.split(':').map(Number);
                    const [bOutH, bOutM] = record.breakEnd.split(':').map(Number);
                    const breakMinutes = (bOutH * 60 + bOutM) - (bInH * 60 + bInM);
                    diffInMinutes -= breakMinutes;
                }
                if (diffInMinutes > 0) {
                    const h = Math.floor(diffInMinutes / 60);
                    const m = diffInMinutes % 60;
                    duration = `${h}j ${m}m`;
                }
            }

            let statusBadge = '<span class="badge-status">Waiting</span>';
            if (record.status?.toLowerCase() === 'ontime') {
                statusBadge = '<span class="badge-status success">Tepat Waktu</span>';
            } else if (record.status?.toLowerCase().includes('lambat')) {
                statusBadge = '<span class="badge-status warning">Terlambat</span>';
            }

            const [y, m, d] = record.date.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
            const dateStr = `${d} ${months[parseInt(m) - 1] || m} ${y}`;

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${record.shift || '-'}</td>
                    <td>${record.clockIn || '--:--'}</td>
                    <td>${record.clockOut || '--:--'}</td>
                    <td>${duration}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    },

    initLiveClock() {
        if (this.liveClockInterval) clearInterval(this.liveClockInterval);

        const updateClock = () => {
            const clockEl = document.getElementById('live-clock');
            const dateEl = document.getElementById('live-date');
            if (clockEl) clockEl.textContent = dateTime.getCurrentTime();
            if (dateEl) dateEl.textContent = dateTime.getCurrentDate();
        };

        updateClock();
        this.liveClockInterval = setInterval(updateClock, 1000);
    },

    // ✅ FIXED BUTTONS
    initButtons() {
        console.log('🔧 Init buttons...');

        // Clock In
        const btnClockIn = document.getElementById('btn-clock-in');
        if (btnClockIn) {
            btnClockIn.onclick = (e) => {
                e.preventDefault();
                console.log('🔥 CLOCK IN CLICKED!');
                this.handleClockIn();
            };
            console.log('✅ Clock In ready');
        }

        // Break
        const btnBreak = document.getElementById('btn-break');
        if (btnBreak) {
            btnBreak.onclick = () => this.handleBreak();
        }

        // After Break
        const btnAfterBreak = document.getElementById('btn-after-break');
        if (btnAfterBreak) {
            btnAfterBreak.onclick = () => this.handleAfterBreak();
        }

        // Overtime
        const btnOvertime = document.getElementById('btn-overtime');
        if (btnOvertime) {
            btnOvertime.onclick = () => this.handleOvertime();
        }

        // Clock Out
        const btnClockOut = document.getElementById('btn-clock-out');
        if (btnClockOut) {
            btnClockOut.onclick = () => this.handleClockOut();
        }
    },

    // ✅ FIXED HANDLERS
    handleClockIn() {
        console.log('🚀 Clock In');
        if (this.attendanceData.clockIn) {
            console.log('⏰ Already clocked in');
            return;
        }
        router.navigate('face-recognition');
        setTimeout(() => {
            console.log('🎥 Init face...');
            window.faceRecognition?.init('clock-in');
        }, 300);
    },

    handleBreak() {
        if (!this.attendanceData.clockIn || this.attendanceData.breakStart) return;
        router.navigate('face-recognition');
        setTimeout(() => window.faceRecognition?.init('break'), 300);
    },

    handleAfterBreak() {
        if (!this.attendanceData.breakStart || this.attendanceData.breakEnd) return;
        router.navigate('face-recognition');
        setTimeout(() => window.faceRecognition?.init('after-break'), 300);
    },

    handleOvertime() {
        if (!this.attendanceData.clockIn) return;
        router.navigate('face-recognition');
        setTimeout(() => window.faceRecognition?.init('overtime'), 300);
    },

    handleClockOut() {
        if (!this.attendanceData.clockIn || this.attendanceData.clockOut) return;
        router.navigate('face-recognition');
        setTimeout(() => window.faceRecognition?.init('clock-out'), 300);
    },

    // ✅ FIXED processWithVerification
    async processWithVerification(action, verificationData) {
        const now = new Date();
        const timeStr = dateTime.formatTime(now);

        switch (action) {
            case 'clock-in':
                this.attendanceData.clockIn = timeStr;
                this.attendanceData.status = 'ontime';
                this.currentState = 'clocked-in';
                toast.success(`Clock In: ${timeStr}`);
                break;
            case 'break':
                this.attendanceData.breakStart = timeStr;
                this.currentState = 'on-break';
                toast.info(`Istirahat: ${timeStr}`);
                break;
            case 'after-break':
                this.attendanceData.breakEnd = timeStr;
                this.currentState = 'clocked-in';
                toast.success(`Kembali kerja: ${timeStr}`);
                break;
            case 'overtime':
                this.attendanceData.overtimeStart = timeStr;
                toast.info(`Lembur: ${timeStr}`);
                break;
            case 'clock-out':
                this.attendanceData.clockOut = timeStr;
                this.currentState = 'completed';
                toast.success(`Clock Out: ${timeStr}`);
                break;
        }

        // ✅ FIXED verification data
        this.attendanceData.verificationTimestamp = verificationData.timestamp;
        this.attendanceData.verificationLocation = verificationData.location;
        this.attendanceData.verificationPhoto = verificationData.photo;

        await this.saveAttendance();
        this.updateUI();
        this.renderTimeline();
        storage.remove('temp_attendance');
    },

    async saveAttendance() {
        const currentUser = auth.getCurrentUser();
        this.attendanceData.userId = currentUser?.id || 'demo-user';

        try {
            const result = await api.saveAttendance(this.attendanceData);
            if (result?.success) {
                this.attendanceData = result.data;
            }
        } catch (error) {
            console.error('❌ Save error:', error);
        }
    },

    updateUI() {
        const statusRing = document.querySelector('.status-ring');
        const statusText = document.querySelector('.status-text');
        const statusSubtext = document.querySelector('.status-subtext');

        if (statusRing) {
            statusRing.className = 'status-ring';
            switch (this.currentState) {
                case 'libur':
                    statusRing.classList.add('waiting');
                    if (statusText) statusText.textContent = 'Hari Libur';
                    break;
                case 'waiting':
                    statusRing.classList.add('waiting');
                    if (statusText) statusText.textContent = 'Siap Clock In';
                    break;
                case 'clocked-in':
                    statusRing.classList.add('active');
                    if (statusText) statusText.textContent = 'Sedang Bekerja';
                    break;
                case 'on-break':
                    statusRing.classList.add('on-break');
                    if (statusText) statusText.textContent = 'Sedang Istirahat';
                    break;
                case 'completed':
                    statusRing.classList.add('completed');
                    if (statusText) statusText.textContent = 'Selesai Bekerja';
                    break;
            }
        }

        // Update buttons
        ['btn-clock-in', 'btn-break', 'btn-after-break', 'btn-overtime', 'btn-clock-out'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = this.isButtonDisabled(id);
                if (this.isButtonCompleted(id)) {
                    btn.classList.add('completed');
                } else {
                    btn.classList.remove('completed');
                }
            }
        });
    },

    isButtonDisabled(id) {
        switch (id) {
            case 'btn-clock-in': return !!this.attendanceData.clockIn;
            case 'btn-break': return !this.attendanceData.clockIn || !!this.attendanceData.breakStart;
            case 'btn-after-break': return !this.attendanceData.breakStart || !!this.attendanceData.breakEnd;
            case 'btn-overtime': return !this.attendanceData.clockIn;
            case 'btn-clock-out': return !this.attendanceData.clockIn || !!this.attendanceData.clockOut;
        }
        return false;
    },

    isButtonCompleted(id) {
        switch (id) {
            case 'btn-clock-in': return !!this.attendanceData.clockIn;
            case 'btn-break': return !!this.attendanceData.breakStart;
            case 'btn-after-break': return !!this.attendanceData.breakEnd;
            case 'btn-overtime': return !!this.attendanceData.overtimeStart;
            case 'btn-clock-out': return !!this.attendanceData.clockOut;
        }
        return false;
    },

    renderTimeline() {
        const timeline = document.getElementById('attendance-timeline');
        if (!timeline) return;

        const items = timeline.querySelectorAll('.timeline-item');
        items.forEach(item => {
            const type = item.dataset.type;
            const timeEl = item.querySelector('.timeline-time');
            item.className = 'timeline-item pending';

            const times = {
                'clock-in': this.attendanceData.clockIn,
                'break': this.attendanceData.breakStart,
                'after-break': this.attendanceData.breakEnd,
                'clock-out': this.attendanceData.clockOut
            };

            if (times[type]) {
                item.classList.remove('pending');
                item.classList.add('completed');
                if (timeEl) timeEl.textContent = times[type];
            }
        });
    }
};

window.initAbsensi = () => absensi.init();
window.absensi = absensi;
