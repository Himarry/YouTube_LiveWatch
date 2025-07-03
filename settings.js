// 設定を管理するモジュール

const SettingsManager = {
    // チャンネルリストを取得
    getChannels: function() {
        const channelsStr = localStorage.getItem('youtube_channels');
        return channelsStr ? JSON.parse(channelsStr) : [];
    },
    
    // チャンネルを追加
    addChannel: function(channelId) {
        const channels = this.getChannels();
        // 既に存在するチャンネルIDは追加しない
        if (!channels.includes(channelId)) {
            channels.push(channelId);
            localStorage.setItem('youtube_channels', JSON.stringify(channels));
            return true;
        }
        return false;
    },
    
    // チャンネルを削除
    removeChannel: function(channelId) {
        let channels = this.getChannels();
        channels = channels.filter(id => id !== channelId);
        localStorage.setItem('youtube_channels', JSON.stringify(channels));
    },
    
    // APIキーを保存
    saveAPIKey: function(apiKey) {
        localStorage.setItem('youtube_api_key', apiKey);
    },
    
    // 設定ページのUIを初期化
    initSettingsUI: function() {
        if (!document.getElementById('channel-list')) {
            return; // 設定ページでない場合は何もしない
        }
        
        const channelList = document.getElementById('channel-list');
        const channelIdInput = document.getElementById('channel-id-input');
        const addChannelBtn = document.getElementById('add-channel-btn');
        const apiKeyInput = document.getElementById('api-key-input');
        const saveApiKeyBtn = document.getElementById('save-api-key-btn');
        const apiKeyStatus = document.getElementById('api-key-status');
        const channelIdStatus = document.getElementById('channel-id-status');
        
        // 既存のチャンネルを表示
        this.renderChannelList();
        
        // API Keyを入力欄に表示
        apiKeyInput.value = YouTubeAPI.getAPIKey();
        
        // チャンネル追加イベント
        addChannelBtn.addEventListener('click', async () => {
            const channelId = channelIdInput.value.trim();
            if (!channelId) {
                channelIdStatus.textContent = 'チャンネルIDを入力してください';
                channelIdStatus.style.color = 'red';
                return;
            }
            
            try {
                // チャンネルIDの有効性を確認
                const channelInfo = await YouTubeAPI.getChannelInfo(channelId);
                if (!channelInfo) {
                    channelIdStatus.textContent = '無効なチャンネルIDです';
                    channelIdStatus.style.color = 'red';
                    return;
                }
                
                // チャンネルを追加
                if (this.addChannel(channelId)) {
                    channelIdInput.value = '';
                    channelIdStatus.textContent = `「${channelInfo.snippet.title}」チャンネルを追加しました`;
                    channelIdStatus.style.color = 'green';
                    this.renderChannelList();
                } else {
                    channelIdStatus.textContent = 'そのチャンネルは既に追加されています';
                    channelIdStatus.style.color = 'orange';
                }
            } catch (error) {
                channelIdStatus.textContent = `エラー: ${error.message}`;
                channelIdStatus.style.color = 'red';
            }
        });
        
        // APIキー保存イベント
        saveApiKeyBtn.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();
            if (!apiKey) {
                apiKeyStatus.textContent = 'APIキーを入力してください';
                apiKeyStatus.style.color = 'red';
                return;
            }
            
            this.saveAPIKey(apiKey);
            apiKeyStatus.textContent = 'APIキーを保存しました';
            apiKeyStatus.style.color = 'green';
            
            // 数秒後にステータスメッセージをクリア
            setTimeout(() => {
                apiKeyStatus.textContent = '';
            }, 3000);
        });

        // ダークモードの設定も反映
        const darkModeEnabled = localStorage.getItem('darkMode') === 'enabled';
        if (darkModeEnabled) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    },
    
    // チャンネルリストをレンダリング - 堅牢性強化
    renderChannelList: async function() {
        const channelList = document.getElementById('channel-list');
        if (!channelList) {
            console.error('チャンネルリスト要素が見つかりません');
            return;
        }
        
        const channels = this.getChannels();
        
        // チャンネルリストをクリア
        channelList.innerHTML = '';
        
        if (channels.length === 0) {
            channelList.innerHTML = '<p class="empty-message"><i class="fas fa-info-circle"></i> 監視するチャンネルがまだ追加されていません</p>';
            return;
        }
        
        // 各チャンネルを表示
        for (const channelId of channels) {
            const item = document.createElement('div');
            item.className = 'channel-item';
            
            try {
                // チャンネル情報を取得
                const channelInfo = await YouTubeAPI.getChannelInfo(channelId);
                const channelName = channelInfo ? channelInfo.snippet.title : channelId;
                
                item.innerHTML = `
                    <div class="channel-info">
                        <strong><i class="fas fa-user-circle"></i> ${channelName}</strong>
                        <div class="channel-id"><small>${channelId}</small></div>
                    </div>
                    <button class="delete-btn" data-channel-id="${channelId}"><i class="fas fa-trash"></i> 削除</button>
                `;
            } catch (error) {
                // エラーの場合はIDのみ表示
                item.innerHTML = `
                    <div class="channel-info">
                        <strong><i class="fas fa-exclamation-triangle"></i> ${channelId}</strong>
                        <div class="channel-id"><small>情報取得エラー</small></div>
                    </div>
                    <button class="delete-btn" data-channel-id="${channelId}"><i class="fas fa-trash"></i> 削除</button>
                `;
            }
            
            channelList.appendChild(item);
        }
        
        // 削除ボタンにイベントリスナーを追加 - イベント委任に変更
        channelList.addEventListener('click', (e) => {
            // クリックされた要素またはその親要素が削除ボタンかどうかを確認
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const channelId = deleteBtn.getAttribute('data-channel-id');
                if (channelId) {
                    this.removeChannel(channelId);
                    this.renderChannelList();
                }
            }
        });
    }
};

// DOMContentLoadedイベントで設定UIを初期化
document.addEventListener('DOMContentLoaded', () => {
    SettingsManager.initSettingsUI();
});
