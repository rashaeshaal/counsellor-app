import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface MediaConstraints {
  audio: boolean;
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
  private currentMediaConstraints: MediaConstraints = { audio: true };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 2; // Reduced from 3
  private isInitiator = false;
  private callTimer: any = null;
  private callStartTime: number | null = null;
  private ringingAudio: HTMLAudioElement | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];
  
  // Performance optimization flags
  private isConnecting = false;
  private offerInProgress = false;
  private answerInProgress = false;

  constructor(private http: HttpClient) {}

  private playRingingSound() {
    if (!this.ringingAudio) {
      this.ringingAudio = new Audio('assets/audio/ringing.mp3');
      this.ringingAudio.loop = true;
      this.ringingAudio.volume = 0.5; // Reduce volume for mobile
    }
    this.ringingAudio.play().catch(e => console.warn('Ringing sound not available:', e));
  }

  private stopRingingSound() {
    if (this.ringingAudio) {
      this.ringingAudio.pause();
      this.ringingAudio.currentTime = 0;
    }
  }

  private setupPeerConnection() {
    console.log('Setting up peer connection...');
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    // Optimized ICE configuration for faster connection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10, // Pre-gather candidates
      bundlePolicy: 'max-bundle' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        this.sendMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          booking_id: this.bookingId
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.remoteStreamSubject.next(this.remoteStream);
        
        if (this.remoteStream.getTracks().length > 0) {
          this.callStateSubject.next('connected');
          this.isConnecting = false;
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('Connection state:', state);
      
      switch (state) {
        case 'connected':
          this.callStateSubject.next('connected');
          this.stopRingingSound();
          this.reconnectAttempts = 0;
          this.callStartTime = Date.now();
          this.isConnecting = false;
          break;
        case 'connecting':
          if (!this.isConnecting) {
            this.callStateSubject.next('connecting');
            this.isConnecting = true;
          }
          break;
        case 'disconnected':
          this.callStateSubject.next('disconnected');
          this.attemptReconnection();
          break;
        case 'failed':
          this.callStateSubject.next('failed');
          this.isConnecting = false;
          this.attemptReconnection();
          break;
        case 'closed':
          this.callStateSubject.next('ended');
          this.isConnecting = false;
          break;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('ICE state:', iceState);
      
      switch (iceState) {
        case 'connected':
        case 'completed':
          if (this.callStateSubject.value !== 'connected') {
            this.callStateSubject.next('connected');
            this.isConnecting = false;
          }
          break;
        case 'disconnected':
          this.callStateSubject.next('disconnected');
          break;
        case 'failed':
          this.callStateSubject.next('failed');
          this.isConnecting = false;
          this.attemptReconnection();
          break;
      }
    };
  }

  private ensurePeerConnection(): boolean {
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
      console.log('Creating new peer connection');
      this.setupPeerConnection();
    }
    return !!(this.peerConnection && this.peerConnection.signalingState !== 'closed');
  }

  private attemptReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isConnecting) {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}`);
      setTimeout(() => {
        this.reconnectWebSocket();
      }, 1000 * this.reconnectAttempts); // Linear backoff for faster retry
    } else {
      console.log('Max reconnection attempts reached');
      this.callStateSubject.next('failed');
      this.isConnecting = false;
    }
  }

  private reconnectWebSocket() {
    if (this.bookingId && (!this.websocket || this.websocket.readyState !== WebSocket.OPEN)) {
      this.connectWebSocket(this.bookingId, this.accessToken);
    }
  }

  async startCall(bookingId: number, constraints: MediaConstraints = { audio: true }, accessToken?: string, sessionDuration?: number): Promise<void> {
    if (this.isConnecting) {
      console.warn('Call already in progress');
      return;
    }

    try {
      this.isConnecting = true;
      if (sessionDuration) {
        this.startCallTimer(sessionDuration);
      }
      
      this.bookingId = bookingId;
      this.accessToken = accessToken || localStorage.getItem('access_token') || null;
      this.currentMediaConstraints = constraints;
      this.reconnectAttempts = 0;
      this.isInitiator = true;
      
      this.callStateSubject.next('initiating');
      this.setupPeerConnection();
      
      // Get media with mobile-optimized constraints
      const mobileConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Lower sample rate for mobile
          channelCount: 1
        }
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
      this.localStreamSubject.next(this.localStream);

      if (this.ensurePeerConnection() && this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      if (!this.accessToken) {
        throw new Error('No authentication token available');
      }

      await this.connectWebSocketAsync(bookingId, this.accessToken);
      this.callStateSubject.next('ringing');
      this.playRingingSound();
      
      // Immediate call initiation
      this.sendMessage({
        type: 'call_initiated',
        booking_id: this.bookingId,
        user_type: 'user'
      });
      
    } catch (error) {
      console.error('Error starting call:', error);
      this.callStateSubject.next('failed');
      this.isConnecting = false;
      throw error;
    }
  }

  async acceptIncomingCall(bookingId: number, constraints: MediaConstraints = { audio: true }, accessToken?: string, sessionDuration?: number): Promise<void> {
    if (this.isConnecting) {
      console.warn('Already processing call');
      return;
    }

    try {
      this.isConnecting = true;
      if (sessionDuration) {
        this.startCallTimer(sessionDuration);
      }
      
      this.bookingId = bookingId;
      this.accessToken = accessToken || localStorage.getItem('access_token') || null;
      this.currentMediaConstraints = constraints;
      this.reconnectAttempts = 0;
      this.isInitiator = false;
      
      this.callStateSubject.next('accepting');
      
      if (this.peerConnection) {
        this.peerConnection.close();
      }
      this.setupPeerConnection();
      
      // Mobile-optimized audio constraints
      const mobileConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
      this.localStreamSubject.next(this.localStream);

      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }

      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        await this.connectWebSocketAsync(bookingId, this.accessToken!);
      }
      
      this.callStateSubject.next('connecting');
      
      // Immediate ready signal
      this.sendMessage({
        type: 'counsellor_ready',
        booking_id: this.bookingId
      });
      
    } catch (error) {
      console.error('Error accepting call:', error);
      this.callStateSubject.next('failed');
      this.isConnecting = false;
      throw error;
    }
  }

  async initializeCounsellorCall(bookingId: number, accessToken?: string): Promise<void> {
    try {
      this.bookingId = bookingId;
      this.accessToken = accessToken || localStorage.getItem('access_token') || null;
      this.isInitiator = false;
      
      if (!this.accessToken) {
        throw new Error('No authentication token available');
      }

      await this.connectWebSocketAsync(bookingId, this.accessToken);
      
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

      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.websocket) {
        this.websocket.close();
      }
      
      try {
        this.websocket = new WebSocket(wsUrl);
        this.bookingId = bookingId;
      } catch (error) {
        this.callStateSubject.next('failed');
        reject(error);
        return;
      }

      const timeout = setTimeout(() => {
        this.callStateSubject.next('failed');
        reject(new Error('WebSocket connection timeout'));
      }, 3000); // Reduced timeout for mobile

      this.websocket.onopen = () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        resolve();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.messageSubject.next(message);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.websocket.onclose = (event) => {
        if (this.callStateSubject.value !== 'ended' && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnection();
        }
      };

      this.websocket.onerror = (error) => {
        clearTimeout(timeout);
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
      this.websocket.send(JSON.stringify(message));
    } else if (this.websocket?.readyState === WebSocket.CONNECTING) {
      // Queue message for immediate send when connected
      setTimeout(() => this.sendMessage(message), 50);
    }
  }

  handleMessage(message: any) {
    switch (message.type) {
      case 'call_initiated':
        this.callStateSubject.next('incoming');
        this.messageSubject.next(message);
        break;
        
      case 'call_accepted':
        this.messageSubject.next(message);
        break;
        
      case 'counsellor_ready':
        this.callStateSubject.next('connecting');
        if (this.isInitiator && !this.offerInProgress) {
          this.createOffer();
        }
        break;
        
      case 'offer':
        this.handleOffer(message);
        break;
        
      case 'answer':
        this.handleAnswer(message);
        break;
        
      case 'ice-candidate':
        this.handleIceCandidate(message);
        break;
        
      case 'call-ended':
      case 'call_ended':
        this.stopRingingSound();
        this.endCall();
        break;
        
      case 'call-rejected':
      case 'call_rejected':
        this.stopRingingSound();
        this.callStateSubject.next('ended');
        this.messageSubject.next(message);
        break;
        
      default:
        this.messageSubject.next(message);
    }
  }

  private startCallTimer(durationInMinutes: number) {
    if (this.callTimer) {
      clearTimeout(this.callTimer);
    }
    const durationInMs = durationInMinutes * 60 * 1000;
    this.callTimer = setTimeout(() => {
      this.endCall();
    }, durationInMs);
  }

  private async handleOffer(message: any) {
    if (this.answerInProgress) {
      console.warn('Answer already in progress');
      return;
    }

    try {
      this.answerInProgress = true;
      
      if (!this.ensurePeerConnection()) {
        throw new Error('Peer connection not ready');
      }
      
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.offer));
      this.processIceCandidateQueue();
      
      if (!this.localStream) {
        const mobileConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1
          }
        };
        this.localStream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
        this.localStreamSubject.next(this.localStream);
        
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection && this.localStream) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }
      
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      
      this.sendMessage({
        type: 'answer',
        answer: answer,
        booking_id: this.bookingId
      });
      
    } catch (error) {
      console.error('Error handling offer:', error);
      this.callStateSubject.next('failed');
    } finally {
      this.answerInProgress = false;
    }
  }

  private async handleAnswer(message: any) {
    try {
      this.stopRingingSound();
      
      if (this.ensurePeerConnection()) {
        await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.answer));
        this.processIceCandidateQueue();
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      this.callStateSubject.next('failed');
    }
  }

  private async handleIceCandidate(message: any) {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
      } else {
        this.iceCandidateQueue.push(message.candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  private async processIceCandidateQueue() {
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error processing queued ICE candidate:', error);
        }
      }
    }
  }

  async createOffer(): Promise<void> {
    if (this.offerInProgress) {
      console.warn('Offer already in progress');
      return;
    }

    try {
      this.offerInProgress = true;
      
      if (!this.ensurePeerConnection()) {
        throw new Error('Peer connection not ready');
      }
      
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true
      });
      
      await this.peerConnection!.setLocalDescription(offer);
      
      this.sendMessage({
        type: 'offer',
        offer: offer,
        booking_id: this.bookingId
      });
      
    } catch (error) {
      console.error('Error creating offer:', error);
      this.callStateSubject.next('failed');
    } finally {
      this.offerInProgress = false;
    }
  }

  rejectCall(): void {
    this.stopRingingSound();
    
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

  endCall(): void {
    this.stopRingingSound();
    this.isConnecting = false;
    
    let actualDuration: number | undefined;
    if (this.callStartTime) {
      const durationInMs = Date.now() - this.callStartTime;
      actualDuration = Math.round(durationInMs / (1000 * 60));
    }

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'call_ended',
        booking_id: this.bookingId,
        user_type: this.isInitiator ? 'user' : 'counsellor',
        actual_duration: actualDuration
      });
    }

    if (this.bookingId && actualDuration !== undefined) {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
      });
      this.http.post(`${environment.apiUrl}/api/dashboard/end_call/`, {
        booking_id: this.bookingId,
        actual_duration: actualDuration
      }, { headers }).subscribe({
        next: (response) => console.log('End call API success:', response),
        error: (error) => console.error('End call API error:', error)
      });
    }

    this.cleanup();
  }

  private cleanup(): void {
    if (this.callTimer) {
      clearTimeout(this.callTimer);
      this.callTimer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
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
    this.isConnecting = false;
    this.offerInProgress = false;
    this.answerInProgress = false;
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
}