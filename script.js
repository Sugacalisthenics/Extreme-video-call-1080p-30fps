const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callButton = document.getElementById('callButton');
const acceptButton = document.getElementById('acceptButton');
const statusText = document.getElementById('statusText');
const qualitySelect = document.getElementById('qualitySelect');

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

// 1. Manual Camera Start
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

qualitySelect.addEventListener('change', (e) => {
    startCamera(e.target.value);
});

// 2. PeerConnection Setup
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate);
        }
    };
}

// 3. UI Logic (Call connect hote hi aapki video hide ho jayegi)
function switchToCallMode() {
    statusText.innerText = "Call Connected! 🟢";
    statusText.style.color = "#00ff88";
    
    // Aapki video poori tarah hide kar di (display: none)
    localVideo.className = 'hidden';
    // Dost ki video ko badi screen par set kar diya
    remoteVideo.className = 'main-video'; 
}

// 4. Call Lagana
callButton.addEventListener('click', async () => {
    statusText.innerText = "Calling... ⏳";
    callButton.style.display = 'none';
    
    setupPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
});

// 5. Offer Aana
socket.on('offer', async (offer) => {
    incomingOffer = offer; 
    statusText.innerText = "Dost ki Call aa rahi hai! 📞";
    statusText.style.color = "#ff3366";
    
    callButton.style.display = 'none';
    acceptButton.style.display = 'inline-block';
});

// 6. Call Uthana
acceptButton.addEventListener('click', async () => {
    acceptButton.style.display = 'none';
    switchToCallMode(); 

    setupPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));

    iceCandidateQueue.forEach(async (candidate) => {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    iceCandidateQueue = [];

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
});

// 7. Dost ne call uthai
socket.on('answer', async (answer) => {
    switchToCallMode(); 
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    iceCandidateQueue.forEach(async (candidate) => {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    iceCandidateQueue = [];
});

// 8. Network Rasta Aana
socket.on('ice-candidate', async (candidate) => {
    if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        iceCandidateQueue.push(candidate);
    }
});

// Start with selected quality
startCamera(qualitySelect.value);