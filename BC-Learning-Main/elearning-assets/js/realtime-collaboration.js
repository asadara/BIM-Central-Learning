// Real-time Collaboration System - Phase 4
// Live video streaming, screen sharing, virtual whiteboards, collaborative note-taking, and synchronized learning sessions

class RealTimeCollaborationSystem {
    constructor() {
        this.socket = null;
        this.peer = null;
        this.localStream = null;
        this.remoteStreams = new Map();
        this.collaborationRooms = new Map();
        this.virtualWhiteboards = new Map();
        this.sharedNotes = new Map();
        this.sessionParticipants = new Map();
        this.screenShareActive = false;
        this.voiceActive = false;
        this.videoActive = false;

        // Collaboration features
        this.features = {
            videoStreaming: true,
            audioStreaming: true,
            screenSharing: true,
            virtualWhiteboard: true,
            collaborativeNotes: true,
            fileSharing: true,
            sessionRecording: true,
            realTimeChat: true,
            breakoutRooms: true,
            handRaising: true,
            polling: true,
            annotations: true
        };

        // Configuration
        this.config = {
            maxParticipants: 50,
            videoQuality: 'high', // low, medium, high, ultra
            audioQuality: 'high',
            enableDataChannel: true,
            enableSFU: true, // Selective Forwarding Unit
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            bandwidthLimits: {
                video: 1000000, // 1Mbps
                audio: 128000,  // 128kbps
                data: 256000    // 256kbps
            }
        };

        this.initializeCollaboration();
    }

    // Initialize Real-time Collaboration System
    async initializeCollaboration() {
        try {
            console.log('Initializing Real-time Collaboration System...');

            // Initialize WebSocket connection
            await this.initializeWebSocket();

            // Initialize WebRTC peer connections
            await this.initializePeerConnections();

            // Setup media devices
            await this.setupMediaDevices();

            // Initialize virtual whiteboard
            this.initializeVirtualWhiteboard();

            // Setup collaborative notes
            this.initializeCollaborativeNotes();

            // Initialize file sharing
            this.initializeFileSharing();

            // Setup UI components
            this.createCollaborationUI();

            // Setup event listeners
            this.setupEventListeners();

            console.log('Real-time Collaboration System initialized successfully');

        } catch (error) {
            console.error('Error initializing collaboration system:', error);
            throw error;
        }
    }

    // Initialize WebSocket Connection
    async initializeWebSocket() {
        const wsUrl = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');

        this.socket = new WebSocket(`${wsUrl}//${window.location.hostname}:${wsPort}/collaboration`);

        this.socket.onopen = () => {
            console.log('WebSocket connected for collaboration');
            this.onWebSocketOpen();
        };

        this.socket.onmessage = (event) => {
            this.handleWebSocketMessage(JSON.parse(event.data));
        };

        this.socket.onclose = () => {
            console.log('WebSocket disconnected');
            this.handleWebSocketClose();
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.handleWebSocketError(error);
        };
    }

    // Initialize WebRTC Peer Connections
    async initializePeerConnections() {
        // Import PeerJS for simplified peer connections
        if (typeof Peer === 'undefined') {
            await this.loadPeerJS();
        }

        this.peer = new Peer({
            host: window.location.hostname,
            port: 9000,
            path: '/peerjs',
            config: {
                iceServers: this.config.iceServers
            }
        });

        this.peer.on('open', (id) => {
            console.log('Peer connection opened with ID:', id);
            this.peerId = id;
            this.onPeerOpen(id);
        });

        this.peer.on('call', (call) => {
            this.handleIncomingCall(call);
        });

        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (error) => {
            console.error('Peer error:', error);
            this.handlePeerError(error);
        });
    }

    // Setup Media Devices
    async setupMediaDevices() {
        try {
            // Get available media devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.mediaDevices = {
                cameras: devices.filter(device => device.kind === 'videoinput'),
                microphones: devices.filter(device => device.kind === 'audioinput'),
                speakers: devices.filter(device => device.kind === 'audiooutput')
            };

            console.log('Media devices detected:', this.mediaDevices);

        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    // Video Streaming Methods

    // Start Video Stream
    async startVideoStream(constraints = null) {
        try {
            const defaultConstraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            const streamConstraints = constraints || defaultConstraints;
            this.localStream = await navigator.mediaDevices.getUserMedia(streamConstraints);

            // Display local video
            this.displayLocalVideo();

            // Notify participants about video start
            this.broadcastToRoom('video_started', {
                peerId: this.peerId,
                timestamp: Date.now()
            });

            this.videoActive = true;
            console.log('Video stream started');

            return this.localStream;

        } catch (error) {
            console.error('Error starting video stream:', error);
            throw error;
        }
    }

    // Stop Video Stream
    stopVideoStream() {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.stop();
            });

            // Clear local video display
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = null;
            }

            // Notify participants about video stop
            this.broadcastToRoom('video_stopped', {
                peerId: this.peerId,
                timestamp: Date.now()
            });

            this.videoActive = false;
            console.log('Video stream stopped');
        }
    }

    // Start Audio Stream
    async startAudioStream() {
        try {
            if (!this.localStream) {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            }

            // Enable audio tracks
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });

            this.voiceActive = true;

            // Update UI
            this.updateAudioUI(true);

            console.log('Audio stream started');

        } catch (error) {
            console.error('Error starting audio stream:', error);
            throw error;
        }
    }

    // Stop Audio Stream
    stopAudioStream() {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

            this.voiceActive = false;

            // Update UI
            this.updateAudioUI(false);

            console.log('Audio stream stopped');
        }
    }

    // Screen Sharing Methods

    // Start Screen Share
    async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });

            // Replace video track with screen share
            if (this.localStream) {
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.peer.connection?.getSenders?.()?.find(s =>
                    s.track && s.track.kind === 'video'
                );

                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            }

            // Handle screen share end
            screenStream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare();
            };

            this.screenShareActive = true;
            this.screenStream = screenStream;

            // Update UI
            this.updateScreenShareUI(true);

            // Notify participants
            this.broadcastToRoom('screen_share_started', {
                peerId: this.peerId,
                timestamp: Date.now()
            });

            console.log('Screen sharing started');

        } catch (error) {
            console.error('Error starting screen share:', error);
            throw error;
        }
    }

    // Stop Screen Share
    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => {
                track.stop();
            });

            // Restore camera stream
            this.restoreCameraStream();

            this.screenShareActive = false;
            this.screenStream = null;

            // Update UI
            this.updateScreenShareUI(false);

            // Notify participants
            this.broadcastToRoom('screen_share_stopped', {
                peerId: this.peerId,
                timestamp: Date.now()
            });

            console.log('Screen sharing stopped');
        }
    }

    // Virtual Whiteboard Methods

    // Initialize Virtual Whiteboard
    initializeVirtualWhiteboard() {
        this.whiteboard = {
            canvas: null,
            context: null,
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            currentTool: 'pen',
            currentColor: '#000000',
            currentSize: 2,
            history: [],
            historyStep: -1,
            tools: ['pen', 'eraser', 'line', 'rectangle', 'circle', 'text'],
            colors: ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
            sizes: [1, 2, 4, 8, 16]
        };

        this.createWhiteboardCanvas();
        this.setupWhiteboardEvents();

        console.log('Virtual whiteboard initialized');
    }

    // Create Whiteboard Canvas
    createWhiteboardCanvas() {
        const whiteboardContainer = document.createElement('div');
        whiteboardContainer.id = 'whiteboardContainer';
        whiteboardContainer.className = 'whiteboard-container';
        whiteboardContainer.style.cssText = `
            display: none;
            position: fixed;
            top: 60px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        `;

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'whiteboard-toolbar';
        toolbar.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #ddd;
            gap: 10px;
            background: #f8f9fa;
            border-radius: 6px 6px 0 0;
        `;

        // Add tools to toolbar
        this.createWhiteboardToolbar(toolbar);

        // Canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'whiteboardCanvas';
        canvas.style.cssText = `
            display: block;
            cursor: crosshair;
            background: white;
        `;

        // Set canvas size
        const resizeCanvas = () => {
            const container = canvas.parentElement;
            canvas.width = container.clientWidth - 40;
            canvas.height = container.clientHeight - toolbar.offsetHeight - 40;
        };

        whiteboardContainer.appendChild(toolbar);
        whiteboardContainer.appendChild(canvas);
        document.body.appendChild(whiteboardContainer);

        this.whiteboard.canvas = canvas;
        this.whiteboard.context = canvas.getContext('2d');

        // Resize canvas when container changes
        new ResizeObserver(resizeCanvas).observe(whiteboardContainer);
        setTimeout(resizeCanvas, 100);
    }

    // Create Whiteboard Toolbar
    createWhiteboardToolbar(toolbar) {
        // Tools
        this.whiteboard.tools.forEach(tool => {
            const button = document.createElement('button');
            button.textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
            button.className = `tool-btn ${tool === this.whiteboard.currentTool ? 'active' : ''}`;
            button.style.cssText = `
                padding: 5px 10px;
                border: 1px solid #ddd;
                background: ${tool === this.whiteboard.currentTool ? '#007bff' : 'white'};
                color: ${tool === this.whiteboard.currentTool ? 'white' : '#333'};
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;

            button.onclick = () => this.selectWhiteboardTool(tool);
            toolbar.appendChild(button);
        });

        // Color picker
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = this.whiteboard.currentColor;
        colorPicker.onchange = (e) => this.setWhiteboardColor(e.target.value);
        toolbar.appendChild(colorPicker);

        // Size selector
        const sizeSelector = document.createElement('select');
        this.whiteboard.sizes.forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = `${size}px`;
            option.selected = size === this.whiteboard.currentSize;
            sizeSelector.appendChild(option);
        });
        sizeSelector.onchange = (e) => this.setWhiteboardSize(parseInt(e.target.value));
        toolbar.appendChild(sizeSelector);

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            padding: 5px 10px;
            border: 1px solid #dc3545;
            background: #dc3545;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        clearBtn.onclick = () => this.clearWhiteboard();
        toolbar.appendChild(clearBtn);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            margin-left: auto;
            padding: 5px 10px;
            border: 1px solid #6c757d;
            background: #6c757d;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
        `;
        closeBtn.onclick = () => this.closeWhiteboard();
        toolbar.appendChild(closeBtn);
    }

    // Setup Whiteboard Events
    setupWhiteboardEvents() {
        const canvas = this.whiteboard.canvas;

        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        canvas.addEventListener('mousemove', (e) => this.draw(e));
        canvas.addEventListener('mouseup', () => this.stopDrawing());
        canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            canvas.dispatchEvent(mouseEvent);
        });
    }

    // Whiteboard Drawing Methods
    startDrawing(e) {
        this.whiteboard.isDrawing = true;
        const rect = this.whiteboard.canvas.getBoundingClientRect();
        this.whiteboard.lastX = e.clientX - rect.left;
        this.whiteboard.lastY = e.clientY - rect.top;

        // Save state for undo
        this.saveWhiteboardState();
    }

    draw(e) {
        if (!this.whiteboard.isDrawing) return;

        const rect = this.whiteboard.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const ctx = this.whiteboard.context;
        ctx.lineWidth = this.whiteboard.currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (this.whiteboard.currentTool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.whiteboard.currentColor;
        } else if (this.whiteboard.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
        }

        ctx.beginPath();
        ctx.moveTo(this.whiteboard.lastX, this.whiteboard.lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();

        // Broadcast drawing data to other participants
        this.broadcastDrawingData({
            tool: this.whiteboard.currentTool,
            color: this.whiteboard.currentColor,
            size: this.whiteboard.currentSize,
            lastX: this.whiteboard.lastX,
            lastY: this.whiteboard.lastY,
            currentX: currentX,
            currentY: currentY,
            type: 'draw'
        });

        this.whiteboard.lastX = currentX;
        this.whiteboard.lastY = currentY;
    }

    stopDrawing() {
        this.whiteboard.isDrawing = false;
    }

    // Collaborative Notes Methods

    // Initialize Collaborative Notes
    initializeCollaborativeNotes() {
        this.collaborativeNotes = {
            documents: new Map(),
            currentDocument: null,
            operationalTransform: new OperationalTransform(),
            userCursors: new Map(),
            changeHistory: []
        };

        this.createNotesInterface();
        console.log('Collaborative notes initialized');
    }

    // Create Notes Interface
    createNotesInterface() {
        const notesContainer = document.createElement('div');
        notesContainer.id = 'collaborativeNotesContainer';
        notesContainer.className = 'collaborative-notes-container';
        notesContainer.style.cssText = `
            display: none;
            position: fixed;
            top: 60px;
            right: 20px;
            width: 400px;
            height: 500px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        `;

        // Notes header
        const header = document.createElement('div');
        header.className = 'notes-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            border-bottom: 1px solid #ddd;
            background: #f8f9fa;
            border-radius: 6px 6px 0 0;
        `;

        const title = document.createElement('h4');
        title.textContent = 'Collaborative Notes';
        title.style.margin = '0';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            border: none;
            background: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
        `;
        closeBtn.onclick = () => this.closeCollaborativeNotes();

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Notes editor
        const editor = document.createElement('textarea');
        editor.id = 'notesEditor';
        editor.className = 'notes-editor';
        editor.placeholder = 'Start typing your notes here...';
        editor.style.cssText = `
            width: 100%;
            height: 400px;
            border: none;
            padding: 15px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            resize: none;
            outline: none;
        `;

        // Setup real-time collaboration
        this.setupNotesCollaboration(editor);

        // Participants list
        const participantsList = document.createElement('div');
        participantsList.id = 'notesParticipants';
        participantsList.style.cssText = `
            padding: 10px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        `;

        notesContainer.appendChild(header);
        notesContainer.appendChild(editor);
        notesContainer.appendChild(participantsList);
        document.body.appendChild(notesContainer);
    }

    // Setup Notes Collaboration
    setupNotesCollaboration(editor) {
        let timeout;

        editor.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.broadcastNotesChange({
                    type: 'text_change',
                    content: editor.value,
                    position: editor.selectionStart,
                    timestamp: Date.now(),
                    userId: this.getCurrentUserId()
                });
            }, 300);
        });

        editor.addEventListener('selectionchange', () => {
            this.broadcastCursorPosition({
                start: editor.selectionStart,
                end: editor.selectionEnd,
                userId: this.getCurrentUserId()
            });
        });
    }

    // File Sharing Methods

    // Initialize File Sharing
    initializeFileSharing() {
        this.fileSharing = {
            activeTransfers: new Map(),
            sharedFiles: new Map(),
            maxFileSize: 50 * 1024 * 1024, // 50MB
            allowedTypes: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'jpg', 'png', 'gif', 'mp4', 'mp3']
        };

        this.createFileShareInterface();
        console.log('File sharing initialized');
    }

    // Create File Share Interface
    createFileShareInterface() {
        // File drop zone
        const dropZone = document.createElement('div');
        dropZone.id = 'fileDropZone';
        dropZone.className = 'file-drop-zone';
        dropZone.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            height: 200px;
            border: 2px dashed #007bff;
            border-radius: 8px;
            background: rgba(0, 123, 255, 0.1);
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            cursor: pointer;
        `;

        const dropText = document.createElement('p');
        dropText.textContent = 'Drop files here to share';
        dropText.style.cssText = `
            margin: 0;
            color: #007bff;
            font-weight: bold;
        `;

        const browseText = document.createElement('p');
        browseText.textContent = 'or click to browse';
        browseText.style.cssText = `
            margin: 5px 0 0 0;
            color: #666;
            font-size: 12px;
        `;

        dropZone.appendChild(dropText);
        dropZone.appendChild(browseText);

        // File input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => this.handleFileSelect(e.target.files);

        dropZone.onclick = () => fileInput.click();

        // Setup drag and drop
        this.setupFileDragDrop(dropZone);

        document.body.appendChild(dropZone);
        document.body.appendChild(fileInput);
    }

    // Setup File Drag and Drop
    setupFileDragDrop(dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => this.highlight(dropZone), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => this.unhighlight(dropZone), false);
        });

        dropZone.addEventListener('drop', (e) => this.handleFileDrop(e), false);
    }

    // Collaboration Room Methods

    // Create Collaboration Room
    async createCollaborationRoom(roomName, options = {}) {
        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            name: roomName,
            creator: this.getCurrentUserId(),
            participants: new Map(),
            features: {
                video: options.video !== false,
                audio: options.audio !== false,
                screenShare: options.screenShare !== false,
                whiteboard: options.whiteboard !== false,
                notes: options.notes !== false,
                fileShare: options.fileShare !== false,
                recording: options.recording || false
            },
            settings: {
                maxParticipants: options.maxParticipants || this.config.maxParticipants,
                requireApproval: options.requireApproval || false,
                allowGuests: options.allowGuests !== false,
                recordSession: options.recordSession || false
            },
            createdAt: Date.now(),
            isActive: true
        };

        this.collaborationRooms.set(roomId, room);

        // Notify server about new room
        this.socket.send(JSON.stringify({
            type: 'create_room',
            data: room
        }));

        console.log('Collaboration room created:', roomId);
        return roomId;
    }

    // Join Collaboration Room
    async joinCollaborationRoom(roomId, userInfo = {}) {
        try {
            const room = this.collaborationRooms.get(roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            if (room.participants.size >= room.settings.maxParticipants) {
                throw new Error('Room is full');
            }

            const participant = {
                id: this.getCurrentUserId(),
                name: userInfo.name || 'Anonymous',
                avatar: userInfo.avatar || null,
                role: room.creator === this.getCurrentUserId() ? 'host' : 'participant',
                joinedAt: Date.now(),
                permissions: {
                    video: true,
                    audio: true,
                    screenShare: room.creator === this.getCurrentUserId(),
                    whiteboard: true,
                    notes: true,
                    fileShare: true
                },
                status: {
                    video: false,
                    audio: false,
                    screenShare: false,
                    handRaised: false
                }
            };

            room.participants.set(participant.id, participant);
            this.currentRoom = roomId;

            // Notify other participants
            this.broadcastToRoom('participant_joined', {
                participant: participant,
                roomId: roomId
            });

            // Start collaboration features
            await this.startCollaborationFeatures(room);

            console.log('Joined collaboration room:', roomId);
            return true;

        } catch (error) {
            console.error('Error joining room:', error);
            throw error;
        }
    }

    // Start Collaboration Features
    async startCollaborationFeatures(room) {
        // Initialize enabled features
        if (room.features.video) {
            this.setupVideoCollaboration();
        }

        if (room.features.whiteboard) {
            this.setupWhiteboardCollaboration();
        }

        if (room.features.notes) {
            this.setupNotesCollaboration();
        }

        if (room.features.fileShare) {
            this.setupFileShareCollaboration();
        }

        // Create collaboration UI
        this.createCollaborationInterface(room);
    }

    // UI Creation Methods

    // Create Collaboration UI
    createCollaborationUI() {
        // Main collaboration controls
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'collaborationControls';
        controlsContainer.className = 'collaboration-controls';
        controlsContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 25px;
            z-index: 1000;
            backdrop-filter: blur(10px);
        `;

        // Video toggle
        const videoBtn = this.createControlButton('📹', 'Toggle Video', () => this.toggleVideo());
        videoBtn.id = 'videoToggle';

        // Audio toggle
        const audioBtn = this.createControlButton('🎤', 'Toggle Audio', () => this.toggleAudio());
        audioBtn.id = 'audioToggle';

        // Screen share toggle
        const screenBtn = this.createControlButton('🖥️', 'Share Screen', () => this.toggleScreenShare());
        screenBtn.id = 'screenToggle';

        // Whiteboard toggle
        const whiteboardBtn = this.createControlButton('📝', 'Whiteboard', () => this.toggleWhiteboard());
        whiteboardBtn.id = 'whiteboardToggle';

        // Notes toggle
        const notesBtn = this.createControlButton('📋', 'Notes', () => this.toggleNotes());
        notesBtn.id = 'notesToggle';

        // File share toggle
        const fileBtn = this.createControlButton('📁', 'Share Files', () => this.toggleFileShare());
        fileBtn.id = 'fileToggle';

        // Participants list
        const participantsBtn = this.createControlButton('👥', 'Participants', () => this.toggleParticipants());
        participantsBtn.id = 'participantsToggle';

        // Leave room
        const leaveBtn = this.createControlButton('🚪', 'Leave', () => this.leaveRoom());
        leaveBtn.id = 'leaveRoom';
        leaveBtn.style.background = '#dc3545';

        controlsContainer.appendChild(videoBtn);
        controlsContainer.appendChild(audioBtn);
        controlsContainer.appendChild(screenBtn);
        controlsContainer.appendChild(whiteboardBtn);
        controlsContainer.appendChild(notesBtn);
        controlsContainer.appendChild(fileBtn);
        controlsContainer.appendChild(participantsBtn);
        controlsContainer.appendChild(leaveBtn);

        document.body.appendChild(controlsContainer);

        // Initially hide controls
        controlsContainer.style.display = 'none';
    }

    // Create Control Button
    createControlButton(icon, tooltip, onClick) {
        const button = document.createElement('button');
        button.innerHTML = icon;
        button.title = tooltip;
        button.className = 'collaboration-control-btn';
        button.style.cssText = `
            width: 50px;
            height: 50px;
            border: none;
            border-radius: 50%;
            background: #007bff;
            color: white;
            font-size: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        button.onmouseover = () => {
            button.style.transform = 'scale(1.1)';
            button.style.background = '#0056b3';
        };

        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.background = '#007bff';
        };

        button.onclick = onClick;
        return button;
    }

    // Event Handlers and Utility Methods

    // WebSocket Event Handlers
    onWebSocketOpen() {
        // Register user
        this.socket.send(JSON.stringify({
            type: 'register',
            data: {
                userId: this.getCurrentUserId(),
                peerId: this.peerId
            }
        }));
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'participant_joined':
                this.handleParticipantJoined(message.data);
                break;
            case 'participant_left':
                this.handleParticipantLeft(message.data);
                break;
            case 'drawing_data':
                this.handleRemoteDrawing(message.data);
                break;
            case 'notes_change':
                this.handleNotesChange(message.data);
                break;
            case 'cursor_position':
                this.handleCursorPosition(message.data);
                break;
            case 'file_share':
                this.handleFileShare(message.data);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    // Toggle Methods
    async toggleVideo() {
        if (this.videoActive) {
            this.stopVideoStream();
        } else {
            await this.startVideoStream();
        }
        this.updateVideoButton();
    }

    async toggleAudio() {
        if (this.voiceActive) {
            this.stopAudioStream();
        } else {
            await this.startAudioStream();
        }
        this.updateAudioButton();
    }

    async toggleScreenShare() {
        if (this.screenShareActive) {
            this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    }

    toggleWhiteboard() {
        const whiteboard = document.getElementById('whiteboardContainer');
        if (whiteboard) {
            whiteboard.style.display = whiteboard.style.display === 'none' ? 'block' : 'none';
        }
    }

    toggleNotes() {
        const notes = document.getElementById('collaborativeNotesContainer');
        if (notes) {
            notes.style.display = notes.style.display === 'none' ? 'block' : 'none';
        }
    }

    toggleFileShare() {
        const fileShare = document.getElementById('fileDropZone');
        if (fileShare) {
            fileShare.style.display = fileShare.style.display === 'none' ? 'flex' : 'none';
        }
    }

    // Utility Methods
    generateRoomId() {
        return 'room_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    getCurrentUserId() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return userData.userId || 'user_' + Date.now();
        } catch (error) {
            return 'user_' + Date.now();
        }
    }

    broadcastToRoom(type, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: type,
                data: data,
                roomId: this.currentRoom,
                timestamp: Date.now()
            }));
        }
    }

    // Static instance method
    static getInstance() {
        if (!window.realTimeCollaborationInstance) {
            window.realTimeCollaborationInstance = new RealTimeCollaborationSystem();
        }
        return window.realTimeCollaborationInstance;
    }
}

// Operational Transform for collaborative editing
class OperationalTransform {
    constructor() {
        this.operations = [];
    }

    transform(op1, op2) {
        // Simplified operational transform
        // In production, use a robust OT library like ShareJS
        return op1;
    }

    apply(operation, document) {
        // Apply operation to document
        return document;
    }
}

// Global instance
window.RealTimeCollaborationSystem = RealTimeCollaborationSystem;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.realTimeCollaboration = RealTimeCollaborationSystem.getInstance();
    console.log('Real-time Collaboration System initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeCollaborationSystem;
}