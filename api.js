// YouTube API関連の処理を管理するモジュール

const YouTubeAPI = {
    // APIキーを設定から取得
    getAPIKey: function() {
        return localStorage.getItem('youtube_api_key') || '';
    },
    
    // ライブ配信中のビデオを取得
    getLiveStreams: async function(channelId) {
        const apiKey = this.getAPIKey();
        if (!apiKey) {
            throw new Error('YouTube API キーが設定されていません');
        }
        
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('YouTube APIからのレスポンスに問題があります');
            }
            
            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error('ライブ配信取得エラー:', error);
            throw error;
        }
    },
    
    // チャンネル情報を取得
    getChannelInfo: async function(channelId) {
        const apiKey = this.getAPIKey();
        if (!apiKey) {
            throw new Error('YouTube API キーが設定されていません');
        }
        
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('YouTube APIからのレスポンスに問題があります');
            }
            
            const data = await response.json();
            return data.items && data.items.length > 0 ? data.items[0] : null;
        } catch (error) {
            console.error('チャンネル情報取得エラー:', error);
            throw error;
        }
    }
};
