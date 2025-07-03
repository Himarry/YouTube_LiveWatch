// 履歴関連の処理を管理するスクリプト

// 履歴データを読み込む
const streamHistory = JSON.parse(localStorage.getItem('stream_history') || '[]');
const channelLastStream = JSON.parse(localStorage.getItem('channel_last_stream') || '{}');

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    // タブ切り替え
    initTabs();
    
    // 履歴データ表示
    renderStreamHistory();
    renderChannelHistory();
    
    // ダークモード設定の適用
    applyDarkModeSettings();
    
    // モーダル機能
    initModal();
});

// タブ切り替え機能
function initTabs() {
    const tabs = document.querySelectorAll('.history-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // タブのアクティブ状態を切り替え
            document.querySelector('.history-tab.active').classList.remove('active');
            this.classList.add('active');
            
            // コンテンツ表示切り替え
            const tabName = this.getAttribute('data-tab');
            document.querySelector('.history-content.active').classList.remove('active');
            document.getElementById(`${tabName}-content`).classList.add('active');
        });
    });
}

// 過去の配信履歴表示
function renderStreamHistory() {
    const historyList = document.getElementById('stream-history-list');
    
    if (streamHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-history"><i class="fas fa-info-circle"></i> 履歴がありません</div>';
        return;
    }
    
    historyList.innerHTML = '';
    
    streamHistory.forEach(stream => {
        const startDate = new Date(stream.startTime);
        const formattedDate = startDate.toLocaleString();
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-thumbnail">
                <img src="${stream.thumbnail}" alt="${stream.title}">
            </div>
            <div class="history-info">
                <div class="history-title">${stream.title}</div>
                <div class="history-channel">${stream.channelTitle}</div>
                <div class="history-date">配信開始: ${formattedDate}</div>
            </div>
        `;
        
        // クリックでYouTubeに移動
        item.addEventListener('click', function() {
            window.open(`https://www.youtube.com/watch?v=${stream.id}`, '_blank');
        });
        
        historyList.appendChild(item);
    });
}

// チャンネル別最終配信時刻表示
function renderChannelHistory() {
    const channelList = document.getElementById('channel-history-list');
    
    const channels = Object.keys(channelLastStream);
    
    if (channels.length === 0) {
        channelList.innerHTML = '<div class="empty-history"><i class="fas fa-info-circle"></i> チャンネルの配信履歴がありません</div>';
        return;
    }
    
    channelList.innerHTML = '';
    
    // チャンネルをアルファベット順にソート
    channels.sort((a, b) => a.localeCompare(b));
    
    channels.forEach(channelName => {
        const lastStreamDate = new Date(channelLastStream[channelName]);
        const formattedDate = lastStreamDate.toLocaleString();
        
        const item = document.createElement('div');
        item.className = 'channel-history-item';
        item.innerHTML = `
            <div class="channel-history-name">${channelName}</div>
            <div class="channel-history-date">最終配信終了: ${formattedDate}</div>
        `;
        
        channelList.appendChild(item);
    });
}

// ダークモード設定の適用
function applyDarkModeSettings() {
    const darkModeEnabled = localStorage.getItem('darkMode') === 'enabled';
    if (darkModeEnabled) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// モーダル関連の処理
function initModal() {
    const aboutLink = document.getElementById('about-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModal = document.querySelector('.close-modal');
    
    if (aboutLink && aboutModal) {
        // モーダルを開く
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            aboutModal.style.display = 'block';
        });
        
        // モーダルを閉じる (×ボタン)
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                aboutModal.style.display = 'none';
            });
        }
        
        // モーダル外をクリックして閉じる
        window.addEventListener('click', function(e) {
            if (e.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    }
}
