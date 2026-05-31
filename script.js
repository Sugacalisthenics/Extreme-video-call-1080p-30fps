const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const acceptButton = document.getElementById('acceptButton');
const statusText = document.getElementById('statusText');
const qualitySelect = document.getElementById('qualitySelect');
const videoContainer = document.getElementById('videoContainer');

const socket = io('https://extreme-video-call-1080p-30fps.onrender.com');

let localStream;
let peerConnection;
let incomingOffer = null;
let iceCandidateQueue = [];

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
    videoContainer.classList.remove('connected');
});

async function startCamera(quality) {
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop()); 
    }
    const constraints = quality === '1080' 
        ? { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true }
        : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
        
        if(peerConnection) {
            const videoTrack = localStream.getVideoTracks()[0];
            const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
            if(sender) sender.replaceTrack(videoTrack);
        }
    } catch (error) {
        console.error("Camera access error:", error);
    }
}

qualitySelect.addEventListener('change', (e) => startCamera(e.target.value));

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
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
    
    videoContainer.classList.add('connected');

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
    
    videoContainer.classList.add('connected');
    
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