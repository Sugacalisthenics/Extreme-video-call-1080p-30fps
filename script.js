const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const acceptButton = document.getElementById('acceptButton');
const statusText = document.getElementById('statusText');
const qualitySelect = document.getElementById('qualitySelect');
const localBox = document.getElementById('localBox');
const remoteBox = document.getElementById('remoteBox');
const videoContainer = document.getElementById('videoContainer');

const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const flipCamBtn = document.getElementById('flipCamBtn');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const pipBtn = document.getElementById('pipBtn'); // PiP Button

const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const attachBtn = document.getElementById('attachBtn'); // Attach Button
const fileInput = document.getElementById('fileInput'); // File Input

const socket = io('https://extreme-video-call-1080p-30fps.onrender.com');

let localStream;
let screenStream;
let peerConnection;
let incomingOffer = null;
let iceCandidateQueue = [];

let isAudioMuted = false;
let isVideoMuted = false;
let currentFacingMode = "user";

const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
};

socket.emit('join');
socket.on('user-joined', () => {
    statusText.innerText = "Participant is online. Ready to call 📞";
    statusText.style.backgroundColor = "#00ff88";
    statusText.style.color = "#000";
    socket.emit('join-ack'); 
});
socket.on('join-ack', () => {
    statusText.innerText = "Participant is online. Ready to call 📞";
    statusText.style.backgroundColor = "#00ff88";
    statusText.style.color = "#000";
});
socket.on('user-left', () => {
    statusText.innerText = "Participant has left the lobby ❌";
    statusText.style.backgroundColor = "#ff3366";
    statusText.style.color = "#fff";
    videoContainer.insertBefore(localBox, remoteBox);
});

// --- CAMERA SETUP ---
async function startCamera(quality) {
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop()); 
    }
    
    const constraints = quality === '1080' 
        ? { video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: currentFacingMode }, audio: true }
        : { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: currentFacingMode }, audio: true };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        if (currentFacingMode === "user" && !screenStream) {
            localVideo.classList.remove('no-mirror');
        } else {
            localVideo.classList.add('no-mirror');
        }
        
        if(peerConnection && !screenStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
            if(sender) sender.replaceTrack(videoTrack);
        }
        
        localStream.getAudioTracks()[0].enabled = !isAudioMuted;
        localStream.getVideoTracks()[0].enabled = !isVideoMuted;

    } catch (error) {
        console.error("Camera access error:", error);
    }
}
qualitySelect.addEventListener('change', (e) => startCamera(e.target.value));

// --- BUTTONS LOGIC (Mic, Cam, Flip) ---
flipCamBtn.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    if (!screenStream) startCamera(qualitySelect.value);
});

toggleMicBtn.addEventListener('click', () => {
    if(localStream) {
        isAudioMuted = !isAudioMuted;
        localStream.getAudioTracks()[0].enabled = !isAudioMuted;
        toggleMicBtn.innerText = isAudioMuted ? "🔇 Mic Off" : "🎤 Mic On";
        toggleMicBtn.classList.toggle('active', isAudioMuted);
    }
});

toggleCamBtn.addEventListener('click', () => {
    if(localStream) {
        isVideoMuted = !isVideoMuted;
        localStream.getVideoTracks()[0].enabled = !isVideoMuted;
        toggleCamBtn.innerText = isVideoMuted ? "🚫 Cam Off" : "📷 Cam On";
        toggleCamBtn.classList.toggle('active', isVideoMuted);
    }
});

// --- SCREEN SHARE ---
shareScreenBtn.addEventListener('click', async () => {
    if (!screenStream) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            }
            localVideo.srcObject = screenStream;
            localVideo.classList.add('no-mirror');
            shareScreenBtn.innerText = "🛑 Stop Share";
            shareScreenBtn.style.backgroundColor = "#ff3366";
            screenTrack.onended = stopScreenShare;
        } catch (e) { console.error("Screen share error", e); }
    } else {
        stopScreenShare();
    }
});
function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    const videoTrack = localStream.getVideoTracks()[0];
    if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
    }
    localVideo.srcObject = localStream;
    if (currentFacingMode === "user") localVideo.classList.remove('no-mirror');
    shareScreenBtn.innerText = "💻 Share Screen";
    shareScreenBtn.style.backgroundColor = "#00aaff";
}

// --- PIP MODE (Native Floating Window) ---
pipBtn.addEventListener('click', async () => {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (remoteVideo.readyState === 4) { // Video zinda honi chahiye
            await remoteVideo.requestPictureInPicture();
        } else {
            alert("Bhai, pehle call toh connect hone de! 😉");
        }
    } catch (error) {
        console.error("PiP failed", error);
    }
});


// --- LIVE CHAT & SECURE FILE SHARING ---
function appendMessage(text, isMe) {
    const msgDiv = document.createElement('div');
    msgDiv.innerText = text;
    msgDiv.style.padding = "8px 12px";
    msgDiv.style.borderRadius = "8px";
    msgDiv.style.maxWidth = "80%";
    msgDiv.style.width = "fit-content";
    msgDiv.style.wordWrap = "break-word";
    msgDiv.style.backgroundColor = isMe ? "#00ff88" : "#444";
    msgDiv.style.color = isMe ? "#000" : "#fff";
    msgDiv.style.alignSelf = isMe ? "flex-end" : "flex-start";
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

function appendFile(fileObj, isMe) {
    const msgDiv = document.createElement('div');
    msgDiv.style.padding = "8px 12px";
    msgDiv.style.borderRadius = "8px";
    msgDiv.style.maxWidth = "80%";
    msgDiv.style.width = "fit-content";
    msgDiv.style.alignSelf = isMe ? "flex-end" : "flex-start";
    msgDiv.style.backgroundColor = isMe ? "#00ff88" : "#444";

    // Agar image hai toh preview dikhao, warna download link
    if (fileObj.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileObj.data;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "4px";
        msgDiv.appendChild(img);
    } else {
        const link = document.createElement('a');
        link.href = fileObj.data;
        link.download = fileObj.name;
        link.innerText = `📁 Download ${fileObj.name}`;
        link.style.color = isMe ? "#000" : "#00ff88";
        link.style.fontWeight = "bold";
        link.style.textDecoration = "none";
        msgDiv.appendChild(link);
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const msg = chatInput.value.trim();
    if (msg) {
        appendMessage(msg, true);
        socket.emit('chat-message', msg); 
        chatInput.value = '';
    }
});
chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendBtn.click(); });
socket.on('chat-message', (msg) => appendMessage(msg, false));

// File Attach Logic
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    
    // Privacy + Performance (Limit 5MB to avoid socket crash)
    if (file.size > 5 * 1024 * 1024) {
        alert("Maximum file size is 5MB for smooth P2P transfer.");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileObj = { name: file.name, type: file.type, data: e.target.result };
        appendFile(fileObj, true);          // Apni screen par dikhao
        socket.emit('file-share', fileObj); // Dost ko bhejo
    };
    reader.readAsDataURL(file);
});
socket.on('file-share', (fileObj) => appendFile(fileObj, false));


// --- CONNECTION LOGIC ---
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    const streamToSend = screenStream ? screenStream : localStream;
    streamToSend.getTracks().forEach(track => peerConnection.addTrack(track, streamToSend));
    
    peerConnection.ontrack = (event) => remoteVideo.srcObject = event.streams[0];
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) socket.emit('ice-candidate', event.candidate);
    };
}

callButton.addEventListener('click', async () => {
    statusText.innerText = "Connecting... ⏳";
    statusText.style.backgroundColor = "#ffcc00";
    statusText.style.color = "#000";
    callButton.style.display = 'none';
    setupPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
});

socket.on('offer', async (offer) => {
    incomingOffer = offer; 
    statusText.innerText = "Incoming video call... 📞";
    statusText.style.backgroundColor = "#ffcc00";
    statusText.style.color = "#000";
    callButton.style.display = 'none';
    acceptButton.style.display = 'inline-block';
});

acceptButton.addEventListener('click', async () => {
    acceptButton.style.display = 'none';
    statusText.innerText = "Connection Established 🟢";
    statusText.style.backgroundColor = "#00ff88";
    videoContainer.insertBefore(remoteBox, localBox);
    setupPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    iceCandidateQueue.forEach(async (candidate) => await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));
    iceCandidateQueue = [];
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

socket.on('answer', async (answer) => {
    statusText.innerText = "Connection Established 🟢";
    statusText.style.backgroundColor = "#00ff88";
    videoContainer.insertBefore(remoteBox, localBox);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    iceCandidateQueue.forEach(async (candidate) => await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)));
    iceCandidateQueue = [];
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        iceCandidateQueue.push(candidate);
    }
});

startCamera(qualitySelect.value);