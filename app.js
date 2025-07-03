// メインアプリケーションロジック

// グローバル変数
const liveStreamsContainer = document.getElementById('live-streams-container');
const statusMessage = document.getElementById('status-message');
const lastUpdatedElement = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-btn');
let darkModeEnabled = localStorage.getItem('darkMode') === 'enabled';
let notificationsEnabled = localStorage.getItem('notifications') === 'enabled';
let compactModeEnabled = localStorage.getItem('compactMode') === 'enabled';
let streamStartTimes = {}; // 配信の開始時間を記録
let favoriteChannels = new Set(JSON.parse(localStorage.getItem('favoriteChannels') || '[]'));
let totalStreamsWatched = parseInt(localStorage.getItem('totalStreamsWatched') || '0');
let currentFilter = 'all';
let searchTerm = '';
let endedStreamTimes = {}; // 配信終了時間を記録
// 視聴者数関連の変数を削除
// let viewerCounts = {}; 
// let concurrentViews = 0;

// 履歴機能のための変数を追加
let streamHistory = JSON.parse(localStorage.getItem('stream_history') || '[]');
let channelLastStream = JSON.parse(localStorage.getItem('channel_last_stream') || '{}');
// 通知済みの配信IDを保存
let notifiedStreamIds = new Set(JSON.parse(localStorage.getItem('notified_stream_ids') || '[]'));

// 現在表示中のライブ配信のIDを追跡
let currentlyDisplayedLiveStreams = new Set();

// YouTube API準備完了時のコールバック（グローバルスコープに配置）
window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube Player API ready');
};

// アプリケーションの初期化
function initApp() {
    // 設定を確認
    const channels = SettingsManager.getChannels();
    const apiKey = YouTubeAPI.getAPIKey();
    
    if (!apiKey) {
        statusMessage.textContent = 'YouTube API キーが設定されていません。設定ページで設定してください。';
        statusMessage.style.color = 'red';
        return;
    }
    
    if (channels.length === 0) {
        statusMessage.textContent = '監視するチャンネルが設定されていません。設定ページで追加してください。';
        return;
    }
    
    // 前回のセッションから配信状態を復元
    const previousDisplayedStreams = JSON.parse(localStorage.getItem('currentlyDisplayedStreams') || '[]');
    previousDisplayedStreams.forEach(id => {
        // 前回表示していた配信は通知済みとしてマーク
        notifiedStreamIds.add(id);
    });
    
    // 初回のチェック
    checkAllChannels();
    
    // 配信の開始・終了のみを定期的にチェック (他の更新は手動)
    setInterval(checkLiveStatus, 60000); // 1分ごとに監視
    
    // 手動更新ボタンのイベントリスナー
    refreshBtn.addEventListener('click', function() {
        checkAllChannels();
        showToast('手動更新を実行しました', 'info');
    });
    
    // ダークモード初期化
    initDarkMode();
    
    // 並び替え機能の初期化
    initSortStreams();
    
    // コンパクトモード初期化
    initCompactMode();
    
    // 検索機能初期化
    initSearch();
    
    // クイックフィルター初期化
    initQuickFilters();
    
    // 一括更新ボタンの削除
    const refreshAllBtn = document.getElementById('refresh-all-btn');
    if (refreshAllBtn) {
        refreshAllBtn.remove(); // ボタンを削除
    }
    
    // 同時視聴数の定期更新をコメントアウト
    // setInterval(updateConcurrentViews, 30000); // 30秒ごとに更新
    
    // 統計表示の更新
    updateStats();
}

// ダークモード初期化・切り替え
function initDarkMode() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    // 初期状態を設定
    if (darkModeEnabled) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.checked = true;
    }
    
    // イベントリスナーを追加
    themeToggle.addEventListener('change', function(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('darkMode', 'enabled');
            darkModeEnabled = true;
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('darkMode', 'disabled');
            darkModeEnabled = false;
        }
    });
}

// 通知機能の初期化
function initNotifications() {
    const notificationsCheckbox = document.getElementById('notifications-checkbox');
    if (!notificationsCheckbox) {
        console.log('通知チェックボックスが見つかりません');
        return;
    }
    
    // 初期状態を設定
    notificationsCheckbox.checked = notificationsEnabled;
    
    // イベントリスナーを追加
    notificationsCheckbox.addEventListener('change', function(e) {
        if (e.target.checked) {
            // ブラウザ通知の許可をリクエスト
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    notificationsEnabled = true;
                    localStorage.setItem('notifications', 'enabled');
                    showToast('配信通知を有効にしました');
                } else {
                    notificationsEnabled = false;
                    e.target.checked = false;
                    showToast('通知の許可が必要です');
                }
            });
        } else {
            notificationsEnabled = false;
            localStorage.setItem('notifications', 'disabled');
            showToast('配信通知を無効にしました');
        }
    });
}

// 並び替え機能の初期化
function initSortStreams() {
    const sortSelect = document.getElementById('sort-streams');
    if (!sortSelect) return;
    
    // 保存された並び順を読み込む
    const savedSort = localStorage.getItem('sortOrder') || 'default';
    sortSelect.value = savedSort;
    
    // イベントリスナーを追加
    sortSelect.addEventListener('change', function(e) {
        const sortOrder = e.target.value;
        localStorage.setItem('sortOrder', sortOrder);
        sortStreams(sortOrder);
    });
}

// コンパクトモードの初期化
function initCompactMode() {
    const compactToggle = document.getElementById('compact-toggle');
    if (!compactToggle) return;
    
    // 初期状態を設定
    if (compactModeEnabled) {
        document.body.classList.add('compact-mode');
        compactToggle.querySelector('i').classList.replace('fa-compress', 'fa-expand');
    }
    
    // イベントリスナーを追加
    compactToggle.addEventListener('click', function() {
        document.body.classList.toggle('compact-mode');
        const isCompact = document.body.classList.contains('compact-mode');
        
        // アイコンを切り替え
        compactToggle.querySelector('i').classList.toggle('fa-compress', !isCompact);
        compactToggle.querySelector('i').classList.toggle('fa-expand', isCompact);
        
        // 設定を保存
        localStorage.setItem('compactMode', isCompact ? 'enabled' : 'disabled');
        compactModeEnabled = isCompact;
    });
}

// 検索機能の初期化
function initSearch() {
    const searchInput = document.getElementById('stream-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function(e) {
        searchTerm = e.target.value.toLowerCase();
        filterStreams();
    });
}

// クイックフィルターの初期化
function initQuickFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    if (!filterTabs || filterTabs.length === 0) {
        console.log('フィルタータブが見つかりません');
        return;
    }
    
    const activeTab = document.querySelector('.filter-tab.active');
    if (!activeTab) {
        console.log('アクティブなフィルタータブが見つかりません');
        // 最初のタブをアクティブに設定
        if (filterTabs.length > 0) {
            filterTabs[0].classList.add('active');
        }
    }
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // アクティブなタブを更新
            const currentActive = document.querySelector('.filter-tab.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            this.classList.add('active');
            
            // フィルターを適用
            currentFilter = this.dataset.filter;
            filterStreams();
        });
    });
}

// 配信の並び替え
function sortStreams(sortOrder) {
    const streamElements = Array.from(liveStreamsContainer.querySelectorAll('.stream-container'));
    
    switch(sortOrder) {
        case 'channel':
            streamElements.sort((a, b) => {
                const channelA = a.querySelector('.channel-name').textContent.toLowerCase();
                const channelB = b.querySelector('.channel-name').textContent.toLowerCase();
                return channelA.localeCompare(channelB);
            });
            break;
        case 'title':
            streamElements.sort((a, b) => {
                const titleA = a.querySelector('.stream-title').textContent.toLowerCase();
                const titleB = b.querySelector('.stream-title').textContent.toLowerCase();
                return titleA.localeCompare(titleB);
            });
            break;
        case 'newest':
            streamElements.sort((a, b) => {
                const idA = a.id.replace('live-stream-', '');
                const idB = b.id.replace('live-stream-', '');
                const timeA = streamStartTimes[idA] || 0;
                const timeB = streamStartTimes[idB] || 0;
                return timeB - timeA; // 降順（新しい順）
            });
            break;
        default:
            // デフォルト順に戻す場合は、DOM順を使用
            streamElements.sort((a, b) => {
                return Array.from(liveStreamsContainer.children).indexOf(a) - 
                       Array.from(liveStreamsContainer.children).indexOf(b);
            });
    }
    
    // 要素を並び替えた順に再配置
    streamElements.forEach(element => liveStreamsContainer.appendChild(element));
}

// 配信のフィルタリング
function filterStreams() {
    const streamElements = document.querySelectorAll('.stream-container');
    
    streamElements.forEach(element => {
        const videoId = element.id.replace('live-stream-', '');
        const title = element.querySelector('.stream-title').textContent.toLowerCase();
        const channelName = element.querySelector('.channel-name').textContent.toLowerCase();
        const favoriteBtn = element.querySelector('.favorite-toggle');
        const isNew = element.querySelector('.new-badge') !== null;
        const isFavorite = favoriteBtn && favoriteBtn.classList.contains('active');
        
        // 検索条件とフィルター条件の両方に一致するか確認
        const matchesSearch = searchTerm === '' || 
                             title.includes(searchTerm) || 
                             channelName.includes(searchTerm);
        
        let matchesFilter = true;
        if (currentFilter === 'favorites') {
            matchesFilter = isFavorite;
        } else if (currentFilter === 'new') {
            matchesFilter = isNew;
        }
        
        // 両方の条件に一致する場合のみ表示
        if (matchesSearch && matchesFilter) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });
}

// 配信の開始・終了のみを自動チェック (バックグラウンド処理)
async function checkLiveStatus() {
    const channels = SettingsManager.getChannels();
    
    if (channels.length === 0) {
        return;
    }
    
    try {
        // 新しいライブストリームのIDを追跡
        const newLiveStreamIds = new Set();
        let newStreamCount = 0;
        let endedStreamCount = 0;
        
        // すべてのチャンネルをチェック (静かに実行)
        for (const channelId of channels) {
            // ライブ配信のチェック
            const liveStreams = await YouTubeAPI.getLiveStreams(channelId);
            for (const stream of liveStreams) {
                const videoId = stream.id.videoId;
                
                // 配信開始時間を記録
                if (!streamStartTimes[videoId]) {
                    streamStartTimes[videoId] = Date.now();
                }
                
                newLiveStreamIds.add(videoId);
                
                // まだ表示されていなければ追加 (新規配信)
                if (!currentlyDisplayedLiveStreams.has(videoId)) {
                    displayLiveStream(stream);
                    // 通知済みリストになければカウント
                    if (!notifiedStreamIds.has(videoId)) {
                        newStreamCount++;
                        // 通知済みとしてマーク
                        notifiedStreamIds.add(videoId);
                        saveNotifiedIds();
                    }
                }
            }
        }
        
        // 終了したライブ配信の処理
        for (const videoId of currentlyDisplayedLiveStreams) {
            if (!newLiveStreamIds.has(videoId)) {
                // 終了時刻を記録
                endedStreamTimes[videoId] = new Date();
                // ライブ配信を終了済みとしてマーク
                markStreamAsEnded(videoId);
                endedStreamCount++;
            }
        }
        
        // 現在のセットを更新
        currentlyDisplayedLiveStreams = newLiveStreamIds;
        
        // ステータスメッセージと最終更新時間を更新（変更があった場合のみ）
        if (newStreamCount > 0 || endedStreamCount > 0) {
            updateStatusMessage();
            updateLastUpdatedTime();
            
            // 並び替えを適用
            const sortOrder = localStorage.getItem('sortOrder') || 'default';
            sortStreams(sortOrder);
            
            // 配信の開始/終了があった場合のみユーザーに通知
            let message = '';
            if (newStreamCount > 0) {
                message += `${newStreamCount}件の新しい配信が開始されました。`;
            }
            if (endedStreamCount > 0) {
                message += `${endedStreamCount}件の配信が終了しました。`;
            }
            showToast(message);
        }
        
        // ステータスインジケーターのアニメーション (控えめなアニメーション)
        const lastUpdatedEl = document.getElementById('last-updated');
        if (lastUpdatedEl) {
            lastUpdatedEl.classList.add('auto-update');
            setTimeout(() => {
                lastUpdatedEl.classList.remove('auto-update');
            }, 1000);
        }
        
        // 統計情報更新
        updateStats();
        
    } catch (error) {
        console.error('自動ステータスチェックエラー:', error);
        // エラーが起きても静かに処理（UIには影響しない）
    }
}

// すべてのチャンネルをチェック (リアルタイム配信開始・終了対応版)
async function checkAllChannels() {
    const channels = SettingsManager.getChannels();
    
    if (channels.length === 0) {
        return;
    }
    
    // インジケーターを更新
    statusMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> チャンネル情報を確認中...';
    
    try {
        // 新しいライブストリームのIDを追跡
        const newLiveStreamIds = new Set();
        let newStreamCount = 0;
        let endedStreamCount = 0;
        
        // すべてのチャンネルをチェック
        for (const channelId of channels) {
            // ライブ配信のチェック
            const liveStreams = await YouTubeAPI.getLiveStreams(channelId);
            for (const stream of liveStreams) {
                const videoId = stream.id.videoId;
                
                // 配信開始時間を記録
                if (!streamStartTimes[videoId]) {
                    streamStartTimes[videoId] = Date.now();
                }
                
                newLiveStreamIds.add(videoId);
                
                // まだ表示されていなければ追加 (新規配信)
                if (!currentlyDisplayedLiveStreams.has(videoId)) {
                    displayLiveStream(stream);
                    // 通知済みリストになければカウント
                    if (!notifiedStreamIds.has(videoId)) {
                        newStreamCount++;
                        // 通知済みとしてマーク
                        notifiedStreamIds.add(videoId);
                        saveNotifiedIds();
                    }
                }
            }
        }
        
        // 終了したライブ配信の処理
        for (const videoId of currentlyDisplayedLiveStreams) {
            if (!newLiveStreamIds.has(videoId)) {
                // 終了時刻を記録
                endedStreamTimes[videoId] = new Date();
                // ライブ配信を終了済みとしてマーク
                markStreamAsEnded(videoId);
                endedStreamCount++;
            }
        }
        
        // 現在のセットを更新
        currentlyDisplayedLiveStreams = newLiveStreamIds;
        
        // ステータスメッセージを更新
        updateStatusMessage();
        
        // 最終更新時間を更新
        updateLastUpdatedTime();
        
        // 並び替えを適用（新しい配信のみに影響する）
        const sortOrder = localStorage.getItem('sortOrder') || 'default';
        sortStreams(sortOrder);
        
        // 配信の開始/終了があった場合のみユーザーに通知
        if (newStreamCount > 0 || endedStreamCount > 0) {
            let message = '';
            if (newStreamCount > 0) {
                message += `${newStreamCount}件の新しい配信が開始されました。`;
            }
            if (endedStreamCount > 0) {
                message += `${endedStreamCount}件の配信が終了しました。`;
            }
            showToast(message);
        }
        
    } catch (error) {
        console.error('チャンネル確認エラー:', error);
        statusMessage.textContent = `エラーが発生しました: ${error.message}`;
        statusMessage.style.color = 'red';
    }
}

// ライブ配信を表示 (視聴者数表示を削除)
function displayLiveStream(stream) {
    const videoId = stream.id.videoId;
    const title = stream.snippet.title;
    const channelTitle = stream.snippet.channelTitle;
    
    // 履歴に追加
    addToHistory(videoId, title, channelTitle, stream.snippet.thumbnails?.default?.url);
    
    // 同時視聴数関連のコードを削除
    // concurrentViews++;
    // updateConcurrentViewsDisplay();
    
    // 視聴者数をランダムに生成する部分を削除
    // const viewerCount = Math.floor(Math.random() * 5000) + 100;
    // viewerCounts[videoId] = viewerCount;
    
    const streamElement = document.createElement('div');
    streamElement.className = 'stream-container';
    streamElement.id = `live-stream-${videoId}`;
    
    // 新着かどうかを判定 - 通知済みリストをチェック
    const isNew = !notifiedStreamIds.has(videoId);
    // お気に入りチャンネルかどうか
    const isFavorite = favoriteChannels.has(channelTitle);
    
    streamElement.innerHTML = `
        <div class="stream-content">
            <div class="stream-video-section">
                <div class="stream-embed" id="player-container-${videoId}">
                    <iframe
                        id="player-${videoId}"
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1"
                        title="${title}"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        width="100%" 
                        height="100%"
                    ></iframe>
                </div>
                <div class="stream-info">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <h3 class="stream-title">
                            ${title}
                            <span class="live-badge">LIVE</span>
                            ${isNew ? '<span class="new-badge">NEW</span>' : ''}
                        </h3>
                        <div class="stream-controls">
                            <button class="share-button" data-video-id="${videoId}" title="共有">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
                    </div>
                    <p class="channel-name">
                        ${channelTitle}
                        <button class="favorite-toggle ${isFavorite ? 'active' : ''}" 
                                data-channel="${channelTitle}" title="お気に入り">
                            <i class="fas fa-star"></i>
                        </button>
                    </p>
                </div>
            </div>
            <div class="stream-comments-section">
                <div class="comments-embed" id="comments-${videoId}">
                    <iframe
                        src="https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}"
                        width="100%"
                        height="100%"
                        frameborder="0"
                        allowfullscreen
                    ></iframe>
                </div>
            </div>
        </div>
    `;
    
    liveStreamsContainer.appendChild(streamElement);
    currentlyDisplayedLiveStreams.add(videoId);
    
    // お気に入りボタンにイベントリスナーを追加
    const favoriteBtn = streamElement.querySelector('.favorite-toggle');
    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', function() {
            toggleFavorite(channelTitle, this);
        });
    }
    
    // シェアボタンにイベントリスナーを追加
    const shareBtn = streamElement.querySelector('.share-button');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            shareStream(videoId, title);
        });
    }
    
    // 統計を更新
    updateStats();
}

// ミュート切り替え機能は不要なので削除または無効化
// function toggleMute(videoId, button) {
//     // 機能を削除
// }

// コメント欄モーダルを開く
function openCommentsModal(videoId, title) {
    const modal = document.getElementById('comments-modal');
    const titleElement = document.getElementById('comments-stream-title');
    const commentsContainer = document.getElementById('comments-container');
    
    if (!modal || !titleElement || !commentsContainer) return;
    
    // モーダルのタイトルを設定
    titleElement.textContent = `コメント欄 - ${title}`;
    
    // コメント欄を埋め込み
    // YouTubeのライブチャット用URLを使用
    const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;
    
    commentsContainer.innerHTML = `
        <iframe
            src="${chatUrl}"
            width="100%"
            height="400"
            frameborder="0"
            allowfullscreen
            style="border-radius: 8px;"
        ></iframe>
    `;
    
    // モーダルを表示
    modal.style.display = 'block';
}

// コメント欄モーダルを閉じる
function closeCommentsModal() {
    const modal = document.getElementById('comments-modal');
    const commentsContainer = document.getElementById('comments-container');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    // iframeを削除してリソースを解放
    if (commentsContainer) {
        commentsContainer.innerHTML = '';
    }
}

// 配信をシェア
function shareStream(videoId, title) {
    const shareUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    if (navigator.share) {
        navigator.share({
            title: title,
            text: 'YouTubeライブ配信を視聴中',
            url: shareUrl
        }).catch(err => {
            console.error('共有に失敗しました:', err);
            // フォールバック: URLをクリップボードにコピー
            copyToClipboard(shareUrl);
        });
    } else {
        // Web Share API未対応のブラウザ: URLをクリップボードにコピー
        copyToClipboard(shareUrl);
    }
}

// クリップボードにコピー
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('URLをクリップボードにコピーしました');
    }).catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
        showToast('URLのコピーに失敗しました');
    });
}

// ライブ配信を削除（修正版）
function removeLiveStream(videoId) {
    const streamElement = document.getElementById(`live-stream-${videoId}`);
    if (streamElement) {
        // 同時視聴数更新部分を削除
        // concurrentViews = Math.max(0, concurrentViews - 1);
        // updateConcurrentViewsDisplay();
        
        // 視聴者数の記録を削除
        // delete viewerCounts[videoId];
        
        // 配信が終了した場合のみオーバーレイ表示
        if (!streamElement.querySelector('.stream-ended')) {
            markStreamAsEnded(videoId);
        }
        
        currentlyDisplayedLiveStreams.delete(videoId);
    }
}

// ライブ配信を終了としてマーク (10分間だけ表示)
function markStreamAsEnded(videoId) {
    const streamElement = document.getElementById(`live-stream-${videoId}`);
    if (!streamElement) return;
    
    const playerContainer = document.getElementById(`player-container-${videoId}`);
    if (!playerContainer) return;
    
    // 配信終了時刻をフォーマット
    const endTime = endedStreamTimes[videoId] || new Date();
    const formattedTime = endTime.toLocaleString();
    
    // チャンネル名を取得して最終配信時刻を更新
    const channelName = streamElement.querySelector('.channel-name').textContent.trim();
    if (channelName) {
        // 最終配信時刻（終了時刻）を更新
        channelLastStream[channelName] = endTime.toISOString();
        localStorage.setItem('channel_last_stream', JSON.stringify(channelLastStream));
    }
    
    // 終了表示オーバーレイを作成
    const endedOverlay = document.createElement('div');
    endedOverlay.className = 'stream-ended';
    endedOverlay.innerHTML = `
        <div class="end-message">配信終了</div>
        <div class="end-time">${formattedTime}</div>
    `;
    
    // オーバーレイを追加
    playerContainer.appendChild(endedOverlay);
    
    // 10分後に配信要素を削除
    setTimeout(() => {
        const element = document.getElementById(`live-stream-${videoId}`);
        if (element) {
            element.remove();
        }
    }, 600000); // 10分 = 600,000ミリ秒
}

// ステータスメッセージを更新
function updateStatusMessage() {
    if (currentlyDisplayedLiveStreams.size > 0) {
        statusMessage.textContent = `現在、${currentlyDisplayedLiveStreams.size}件のライブ配信中です。`;
        statusMessage.style.color = '#00b300';
    } else {
        statusMessage.textContent = '現在、ライブ配信はありません。';
        statusMessage.style.color = '#333';
    }
}

// 最終更新時間を更新
function updateLastUpdatedTime() {
    const now = new Date();
    lastUpdatedElement.textContent = now.toLocaleTimeString();
}

// トースト通知を表示する関数
function showToast(message) {
    // 既存のトースト要素があれば削除
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 新しいトースト要素を作成
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // アニメーション表示
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 3秒後に非表示
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 3000);
}

// カスタマイズ可能なトースト通知
function showToast(message, type = 'default') {
    // 既存のトースト要素があれば削除
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 新しいトースト要素を作成
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // アニメーション表示
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 表示時間を調整（情報通知は短め）
    const displayTime = type === 'info' ? 1500 : 3000;
    
    // 表示時間後に非表示
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, displayTime);
}

// 統計情報の更新
function updateStats() {
    const totalChannelsElement = document.getElementById('total-channels');
    const totalStreamsElement = document.getElementById('total-streams');
    
    if (totalChannelsElement) {
        const channels = SettingsManager.getChannels();
        totalChannelsElement.textContent = channels.length;
    }
    
    if (totalStreamsElement) {
        totalStreamsElement.textContent = currentlyDisplayedLiveStreams.size;
    }
}

// お気に入りチャンネルの切り替え
function toggleFavorite(channelName, button) {
    if (favoriteChannels.has(channelName)) {
        favoriteChannels.delete(channelName);
        button.classList.remove('active');
    } else {
        favoriteChannels.add(channelName);
        button.classList.add('active');
    }
    
    // localStorageに保存
    localStorage.setItem('favoriteChannels', JSON.stringify([...favoriteChannels]));
    
    // もし現在お気に入りフィルターが有効な場合は再フィルタリング
    if (currentFilter === 'favorites') {
        filterStreams();
    }
}

// 同時視聴数関連の関数を削除
// updateConcurrentViews() 
// updateConcurrentViewsDisplay()
// updateViewerCounts()

// 履歴に配信を追加
function addToHistory(videoId, title, channelTitle, thumbnail) {
    // 最新の配信情報を作成
    const streamData = {
        id: videoId,
        title: title,
        channelTitle: channelTitle,
        thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/default.jpg`,
        startTime: new Date().toISOString()
    };
    
    // 既存のエントリがあれば更新、なければ追加
    const existingIndex = streamHistory.findIndex(item => item.id === videoId);
    if (existingIndex !== -1) {
        streamHistory[existingIndex] = streamData;
    } else {
        // 最大100件まで保存
        if (streamHistory.length >= 100) {
            streamHistory.pop(); // 最も古いものを削除
        }
        streamHistory.unshift(streamData); // 最新を先頭に追加
    }
    
    // 最終配信時刻は配信終了時に記録するため、ここでは記録しない
    // channelLastStream[channelTitle] = new Date().toISOString(); の行を削除
    
    // ローカルストレージに保存（チャンネル最終配信時刻は削除）
    localStorage.setItem('stream_history', JSON.stringify(streamHistory));
}

// 通知済みのIDをローカルストレージに保存
function saveNotifiedIds() {
    localStorage.setItem('notified_stream_ids', JSON.stringify([...notifiedStreamIds]));
}

// ページ離脱時に現在表示中の配信を保存
window.addEventListener('beforeunload', function() {
    // ユーザーがページを離れる際に現在の配信状態を保存
    localStorage.setItem('currentlyDisplayedStreams', JSON.stringify([...currentlyDisplayedLiveStreams]));
});

// DOMContentLoadedイベントでアプリ初期化
document.addEventListener('DOMContentLoaded', initApp);

// モーダル関連の機能
document.addEventListener('DOMContentLoaded', function() {
    const aboutLink = document.getElementById('about-link');
    const aboutModal = document.getElementById('about-modal');
    const closeModal = document.querySelector('.close-modal');
    
    // コメント欄モーダルの関連要素
    const commentsModal = document.getElementById('comments-modal');
    const commentsClose = document.querySelector('.comments-close');
    
    if (aboutLink && aboutModal) {
        // aboutモーダルを開く
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            aboutModal.style.display = 'block';
        });
        
        // aboutモーダルを閉じる (×ボタン)
        if (closeModal) {
            closeModal.addEventListener('click', function() {
                aboutModal.style.display = 'none';
            });
        }
        
        // aboutモーダル外をクリックして閉じる
        window.addEventListener('click', function(e) {
            if (e.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    }
    
    // コメント欄モーダルの処理
    if (commentsModal && commentsClose) {
        // コメント欄モーダルを閉じる (×ボタン)
        commentsClose.addEventListener('click', function() {
            closeCommentsModal();
        });
        
        // コメント欄モーダル外をクリックして閉じる
        window.addEventListener('click', function(e) {
            if (e.target === commentsModal) {
                closeCommentsModal();
            }
        });
    }
});
