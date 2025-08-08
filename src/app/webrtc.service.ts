import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface MediaConstraints {
  audio: boolean;
  video: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {
  private messageSubject = new Subject<any>();
  private callStateSubject = new BehaviorSubject<string>('idle');
  private localStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  private remoteStreamSubject = new BehaviorSubject<MediaStream | null>(null);
  
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private websocket: WebSocket | null = null;
  private bookingId: number | null = null;
  private accessToken: string | null = null;
  private currentMediaConstraints: MediaConstraints = { audio: true, video: false };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private isInitiator = false; // Track if this instance initiated the call

  constructor(private http: HttpClient) {}

  private setupPeerConnection() {
    console.log('Setting up peer connection...');
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    console.log('Peer connection created with state:', this.peerConnection.signalingState);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        this.sendMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          booking_id: this.bookingId
        });
      } else {
        console.log('All ICE candidates have been sent');
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.remoteStreamSubject.next(this.remoteStream);
        
        // Only set to connected if we actually receive tracks
        if (this.remoteStream.getTracks().length > 0) {
          this.callStateSubject.next('connected');
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Peer connection state:', state);
      
      switch (state) {
        case 'connected':
          this.callStateSubject.next('connected');
          this.reconnectAttempts = 0;
          break;
        case 'connecting':
          this.callStateSubject.next('connecting');
          break;
        case 'disconnected':
          this.callStateSubject.next('disconnected');
          this.attemptReconnection();
          break;
        case 'failed':
          this.callStateSubject.next('failed');
          this.attemptReconnection();
          break;
        case 'closed':
          this.callStateSubject.next('ended');
          break;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('ICE connection state:', iceState);
      
      switch (iceState) {
        case 'connected':
        case 'completed':
          if (this.callStateSubject.value !== 'connected') {
            this.callStateSubject.next('connected');
          }
          break;
        case 'disconnected':
          this.callStateSubject.next('disconnected');
          break;
        case 'failed':
          this.callStateSubject.next('failed');
          this.attemptReconnection();
          break;
        case 'checking':
          this.callStateSubject.next('connecting');
          break;
      }
    };
  }

  private ensurePeerConnection(): boolean {
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
      console.log('Peer connection is null or closed, creating new one...');
      this.setupPeerConnection();
    }
    
    const isReady = !!(this.peerConnection && this.peerConnection.signalingState !== 'closed');
    console.log('Peer connection ready:', isReady, 'State:', this.peerConnection?.signalingState);
    return isReady;
  }

  private attemptReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => {
        this.reconnectWebSocket();
      }, 1000 * Math.pow(2, this.reconnectAttempts));
    } else {
      console.log('Max reconnection attempts reached');
      this.callStateSubject.next('failed');
      this.messageSubject.next({ 
        type: 'error', 
        message: 'Failed to connect to call server after multiple attempts' 
      });
    }
  }

  private reconnectWebSocket() {
    if (this.bookingId && (!this.websocket || this.websocket.readyState !== WebSocket.OPEN)) {
      console.log('Reconnecting WebSocket for booking:', this.bookingId);
      this.connectWebSocket(this.bookingId, this.accessToken);
    }
  }

  // User initiates call (from checkout component)
  async startCall(bookingId: number, constraints: MediaConstraints = { audio: true, video: false }, accessToken?: string): Promise<void> {
    try {
      this.bookingId = bookingId;
      this.accessToken = accessToken || localStorage.getItem('access_token') || null;
      this.currentMediaConstraints = constraints;
      this.reconnectAttempts = 0;
      this.isInitiator = true;
      
      console.log('User starting call with constraints:', constraints);
      this.callStateSubject.next('initiating');
      
      // Setup peer connection
      this.setupPeerConnection();
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStreamSubject.next(this.localStream);
      console.log('Local stream obtained:', this.localStream);

      // Add tracks to peer connection
      if (this.ensurePeerConnection() && this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            console.log('Adding track to peer connection:', track.kind, 'State:', this.peerConnection.signalingState);
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      } else {
        throw new Error('Peer connection not ready');
      }

      if (!this.accessToken) {
        console.error('No access token provided for WebSocket connection');
        this.callStateSubject.next('failed');
        throw new Error('No authentication token available');
      }

      // Connect to WebSocket
      await this.connectWebSocketAsync(bookingId, this.accessToken);
      this.callStateSubject.next('ringing');
      
      // Send call initiation message
      this.sendMessage({
        type: 'call_initiated',
        booking_id: this.bookingId,
        user_type: 'user'
      });
      
    } catch (error) {
      console.error('Error starting call:', error);
      this.callStateSubject.next('failed');
      throw error;
    }
  }

  // Counsellor accepts incoming call
  async acceptIncomingCall(bookingId: number, constraints: MediaConstraints = { audio: true, video: false }, accessToken?: string): Promise<void> {
    try {
        this.bookingId = bookingId;
        this.accessToken = accessToken || localStorage.getItem('access_token') || null;
        this.currentMediaConstraints = constraints;
        this.reconnectAttempts = 0;
        this.isInitiator = false;
        
        console.log('Counsellor accepting incoming call with bookingId:', bookingId, 'constraints:', constraints);
        this.callStateSubject.next('accepting');
        
        // Ensure we have a fresh peer connection
        if (this.peerConnection) {
            console.log('Closing existing peer connection before accepting call');
            this.peerConnection.close();
        }
        this.setupPeerConnection();
        
        // Get user media
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Local stream obtained for counsellor:', this.localStream, 'Tracks:', this.localStream.getTracks());
            this.localStreamSubject.next(this.localStream);
        } catch (mediaError) {
            console.error('Failed to get user media:', mediaError);
            this.callStateSubject.next('failed');
            throw new Error('Failed to access camera/microphone');
        }

        // Add tracks to peer connection
        if (this.localStream && this.peerConnection) {
            this.localStream.getTracks().forEach(track => {
                if (this.peerConnection && this.localStream) {
                    console.log('Adding track to peer connection:', track.kind, 'Enabled:', track.enabled);
                    this.peerConnection.addTrack(track, this.localStream);
                }
            });
        }

        if (!this.accessToken) {
            console.error('No access token provided for WebSocket connection');
            this.callStateSubject.next('failed');
            throw new Error('No authentication token available');
        }

        // Ensure WebSocket is connected
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            console.log('WebSocket not connected, connecting now...');
            await this.connectWebSocketAsync(bookingId, this.accessToken);
        }
        
        console.log('WebSocket connected for accepting call');
        this.callStateSubject.next('connecting');
        
        // Send call accepted message
        this.sendMessage({
            type: 'call_accepted',
            booking_id: this.bookingId,
            user_type: 'counsellor'
        });
        
        console.log('Call accepted message sent, waiting for offer...');
        
    } catch (error) {
        console.error('Error accepting incoming call:', error);
        this.callStateSubject.next('failed');
        throw error;
    }
}

  // Initialize for counsellor to listen for incoming calls
  async initializeCounsellorCall(bookingId: number, accessToken?: string): Promise<void> {
    try {
      this.bookingId = bookingId;
      this.accessToken = accessToken || localStorage.getItem('access_token') || null;
      this.isInitiator = false;
      
      console.log('Initializing counsellor call listener for booking:', bookingId);
      
      if (!this.accessToken) {
        throw new Error('No authentication token available');
      }

      // Connect to WebSocket to listen for incoming calls
      await this.connectWebSocketAsync(bookingId, this.accessToken);
      console.log('Counsellor WebSocket initialized for booking:', bookingId);
      
    } catch (error) {
      console.error('Error initializing counsellor call:', error);
      this.callStateSubject.next('failed');
      throw error;
    }
  }

  private async connectWebSocketAsync(bookingId: number, accessToken: string | null = null): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const effectiveToken = accessToken || localStorage.getItem('access_token') || null;
      const wsUrl = effectiveToken
        ? `${environment.wsUrl}/ws/call/${bookingId}/?token=${effectiveToken}`
        : `${environment.wsUrl}/ws/call/${bookingId}/`;
      console.log(`Connecting to WebSocket URL: ${wsUrl}`);

      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        resolve();
        return;
      }

      if (this.websocket) {
        console.log('Closing existing WebSocket connection');
        this.websocket.close();
      }
      
      try {
        this.websocket = new WebSocket(wsUrl);
        this.bookingId = bookingId;
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.callStateSubject.next('failed');
        reject(error);
        return;
      }

      const timeout = setTimeout(() => {
        console.error(`WebSocket connection timeout for ${wsUrl}`);
        this.callStateSubject.next('failed');
        reject(new Error(`WebSocket connection timeout for ${wsUrl}`));
      }, 10000);

      this.websocket.onopen = () => {
        clearTimeout(timeout);
        console.log('WebSocket connected successfully for booking', bookingId);
        this.reconnectAttempts = 0;
        resolve();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received for booking', bookingId, ':', message);
          this.messageSubject.next(message);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = (event) => {
        console.log(`WebSocket disconnected for booking ${bookingId}: code=${event.code}, reason=${event.reason}`);
        if (this.callStateSubject.value !== 'ended' && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnection();
        } else if (this.callStateSubject.value !== 'ended') {
          this.callStateSubject.next('disconnected');
        }
      };

      this.websocket.onerror = (error) => {
        clearTimeout(timeout);
        console.error(`WebSocket error for ${wsUrl}:`, error);
        this.callStateSubject.next('failed');
        reject(error);
      };
    });
  }

  public async connectWebSocket(bookingId: number, accessToken: string | null = null): Promise<void> {
    return this.connectWebSocketAsync(bookingId, accessToken);
  }

  private sendMessage(message: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', message);
      this.websocket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not ready, message not sent:', message);
      if (this.websocket?.readyState === WebSocket.CONNECTING) {
        setTimeout(() => this.sendMessage(message), 100);
      }
    }
  }

  handleMessage(message: any) {
    console.log('Handling message:', message);
    
    switch (message.type) {
        case 'call_initiated':
            // Counsellor receives this when user starts a call
            console.log('Call initiated by user, setting state to incoming');
            this.callStateSubject.next('incoming');
            this.messageSubject.next(message);
            break;
            
        case 'call_accepted':
            // User receives this when counsellor accepts
            console.log('Call accepted by counsellor, user should create offer');
            this.callStateSubject.next('connecting');
            this.messageSubject.next(message);
            
            // If user initiated the call, create offer now
            if (this.isInitiator) {
                console.log('User is initiator, creating offer...');
                setTimeout(() => {
                    this.createOffer();
                }, 1000); // Increased delay to ensure counsellor is ready
            }
            break;
            
        case 'offer':
            console.log('Received offer, handling...');
            this.handleOffer(message);
            break;
            
        case 'answer':
            console.log('Received answer, handling...');
            this.handleAnswer(message);
            break;
            
        case 'ice-candidate':
            console.log('Received ICE candidate, handling...');
            this.handleIceCandidate(message);
            break;
            
        case 'call-ended':
        case 'call_ended':
            console.log('Call ended message received');
            this.endCall();
            break;
            
        case 'call-rejected':
        case 'call_rejected':
            console.log('Call rejected message received');
            this.callStateSubject.next('ended');
            this.messageSubject.next(message);
            break;
            
        case 'media-toggle':
            this.handleMediaToggle(message);
            break;
            
        default:
            console.log('Unknown message type:', message.type);
            this.messageSubject.next(message);
    }
}


  private async handleOffer(message: any) {
    try {
        console.log('Handling offer:', message.offer);
        
        if (!this.ensurePeerConnection()) {
            throw new Error('Peer connection not ready for offer');
        }
        
        // Set remote description
        console.log('Setting remote description with offer...');
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.offer));
        console.log('Remote description set successfully');
        
        // Ensure we have local stream and add tracks if not already added
        if (!this.localStream) {
            console.log('No local stream, getting user media...');
            this.localStream = await navigator.mediaDevices.getUserMedia(this.currentMediaConstraints);
            this.localStreamSubject.next(this.localStream);
            
            this.localStream.getTracks().forEach(track => {
                if (this.peerConnection && this.localStream && !this.peerConnection.getSenders().some(sender => sender.track === track)) {
                    console.log('Adding track for answer:', track.kind);
                    this.peerConnection.addTrack(track, this.localStream);
                }
            });
        } else {
            // Ensure all local tracks are added to the peer connection
            this.localStream.getTracks().forEach(track => {
                if (this.peerConnection && !this.peerConnection.getSenders().some(sender => sender.track === track)) {
                    console.log('Adding existing local track to peer connection:', track.kind);
                    this.peerConnection.addTrack(track, this.localStream!);
                }
            });
        }
        
        // Create and send answer
        console.log('Creating answer...');
        const answer = await this.peerConnection!.createAnswer();
        console.log('Answer created, setting local description...');
        await this.peerConnection!.setLocalDescription(answer);
        
        console.log('Sending answer...');
        this.sendMessage({
            type: 'answer',
            answer: answer,
            booking_id: this.bookingId
        });
        
        console.log('Answer sent successfully');
        
    } catch (error) {
        console.error('Error handling offer:', error);
        this.callStateSubject.next('failed');
    }
}

  private async handleAnswer(message: any) {
    try {
      console.log('Handling answer:', message.answer);
      
      if (this.ensurePeerConnection()) {
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.answer));
        console.log('Answer processed successfully');
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      this.callStateSubject.next('failed');
    }
  }

  private async handleIceCandidate(message: any) {
    try {
      console.log('Handling ICE candidate:', message.candidate);
      
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        console.log('ICE candidate added successfully');
      } else {
        console.warn('Cannot add ICE candidate - no remote description');
        // Queue the candidate for later if remote description isn't set yet
        setTimeout(() => {
          if (this.peerConnection && this.peerConnection.remoteDescription) {
            this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate))
              .catch(err => console.error('Delayed ICE candidate add failed:', err));
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private handleMediaToggle(message: any) {
    console.log('Remote peer toggled media:', message);
    this.messageSubject.next(message);
  }

  async createOffer(): Promise<void> {
    try {
        if (!this.ensurePeerConnection()) {
            throw new Error('Peer connection not ready for creating offer');
        }
        
        console.log('Creating offer with peer connection state:', this.peerConnection!.signalingState);
        const offer = await this.peerConnection!.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: this.currentMediaConstraints.video
        });
        
        console.log('Offer created, setting local description...');
        await this.peerConnection!.setLocalDescription(offer);
        
        console.log('Sending offer...');
        this.sendMessage({
            type: 'offer',
            offer: offer,
            booking_id: this.bookingId
        });
        
        console.log('Offer sent successfully');
        
    } catch (error) {
        console.error('Error creating offer:', error);
        this.callStateSubject.next('failed');
    }
}

  rejectCall(): void {
    console.log('Rejecting call...');
    
    this.sendMessage({
      type: 'call_rejected',
      booking_id: this.bookingId,
      user_type: this.isInitiator ? 'user' : 'counsellor'
    });

    this.endCall();
  }

  async toggleAudio(): Promise<boolean> {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('Audio toggled:', audioTrack.enabled);
        
        this.sendMessage({
          type: 'media-toggle',
          mediaType: 'audio',
          enabled: audioTrack.enabled,
          booking_id: this.bookingId
        });
        
        return audioTrack.enabled;
      }
    }
    return false;
  }

  async toggleVideo(): Promise<boolean> {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('Video toggled:', videoTrack.enabled);
        
        this.sendMessage({
          type: 'media-toggle',
          mediaType: 'video',
          enabled: videoTrack.enabled,
          booking_id: this.bookingId
        });
        
        return videoTrack.enabled;
      }
    }
    return false;
  }

  async enableVideo(): Promise<boolean> {
    try {
      if (this.localStream && this.localStream.getVideoTracks().length > 0) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        videoTrack.enabled = true;
        console.log('Video enabled:', videoTrack.enabled);
        
        this.sendMessage({
          type: 'media-toggle',
          mediaType: 'video',
          enabled: videoTrack.enabled,
          booking_id: this.bookingId
        });
        
        return true;
      } else {
        // Need to get new stream with video
        this.currentMediaConstraints.video = true;
        const newStream = await navigator.mediaDevices.getUserMedia(this.currentMediaConstraints);
        
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => track.stop());
        }
        
        this.localStream = newStream;
        this.localStreamSubject.next(this.localStream);
        
        if (this.ensurePeerConnection() && this.localStream) {
          // Replace tracks in peer connection
          this.localStream.getTracks().forEach(track => {
            if (this.peerConnection && this.localStream) {
              console.log('Adding new track to peer connection:', track.kind, track.enabled);
              const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === track.kind);
              if (sender) {
                sender.replaceTrack(track);
              } else {
                this.peerConnection.addTrack(track, this.localStream);
              }
            }
          });
        }
        
        this.sendMessage({
          type: 'media-toggle',
          mediaType: 'video',
          enabled: true,
          booking_id: this.bookingId
        });
        
        return true;
      }
    } catch (error) {
      console.error('Error enabling video:', error);
      return false;
    }
  }

  endCall(): void {
    console.log('Ending call...');
    
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'call_ended',
        booking_id: this.bookingId,
        user_type: this.isInitiator ? 'user' : 'counsellor'
      });
    }

    this.cleanup();
  }

  private cleanup(): void {
    console.log('Cleaning up WebRTC resources...');

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      this.localStream = null;
      this.localStreamSubject.next(null);
    }

    if (this.remoteStream) {
      this.remoteStream = null;
      this.remoteStreamSubject.next(null);
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.bookingId = null;
    this.accessToken = null;
    this.reconnectAttempts = 0;
    this.isInitiator = false;
    this.callStateSubject.next('ended');
  }

  // Observable methods
  getMessageObservable(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  getCallStateObservable(): Observable<string> {
    return this.callStateSubject.asObservable();
  }

  getLocalStreamObservable(): Observable<MediaStream | null> {
    return this.localStreamSubject.asObservable();
  }

  getRemoteStreamObservable(): Observable<MediaStream | null> {
    return this.remoteStreamSubject.asObservable();
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getCurrentCallState(): string {
    return this.callStateSubject.value;
  }

  isAudioEnabled(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? audioTrack.enabled : false;
    }
    return false;
  }

  isVideoEnabled(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      return videoTrack ? videoTrack.enabled : false;
    }
    return false;
  }

  hasVideoTrack(): boolean {
    if (this.localStream) {
      return this.localStream.getVideoTracks().length > 0;
    }
    return false;
  }
}