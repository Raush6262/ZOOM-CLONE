import React, { Component } from 'react';
import io from 'socket.io-client';
import faker from 'faker';

import {
  IconButton,
  Badge,
  Button,
  Paper,
  Typography,
  TextField,
  Tooltip,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import MicIcon from '@material-ui/icons/Mic';
import MicOffIcon from '@material-ui/icons/MicOff';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import CallEndIcon from '@material-ui/icons/CallEnd';
import ChatIcon from '@material-ui/icons/Chat';

import { message } from 'antd';
import 'antd/dist/antd.css';

import './Video.css';

const server_url = process.env.NODE_ENV === 'production' ? 'https://video.sebastienbiollo.com' : 'http://localhost:4001';

var connections = {};
const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};
var socket = null;
var socketId = null;

class Video extends Component {
  constructor(props) {
    super(props);

    this.localVideoref = React.createRef();

    this.videoAvailable = false;
    this.audioAvailable = false;

    this.state = {
      video: false,
      audio: false,
      screen: false,
      showModal: false,
      screenAvailable: false,
      messages: [],
      message: '',
      newmessages: 0,
      askForUsername: true,
      username: faker.internet.userName(),
      // users: [], // Optional: Uncomment to track active users
    };
    connections = {};

    this.getPermissions();
  }

  getPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => (this.videoAvailable = true))
        .catch(() => (this.videoAvailable = false));

      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => (this.audioAvailable = true))
        .catch(() => (this.audioAvailable = false));

      if (navigator.mediaDevices.getDisplayMedia) {
        this.setState({ screenAvailable: true });
      } else {
        this.setState({ screenAvailable: false });
      }

      if (this.videoAvailable || this.audioAvailable) {
        navigator.mediaDevices
          .getUserMedia({ video: this.videoAvailable, audio: this.audioAvailable })
          .then((stream) => {
            window.localStream = stream;
            this.localVideoref.current.srcObject = stream;
          })
          .catch((e) => console.log(e));
      }
    } catch (e) {
      console.log(e);
    }
  };

  getMedia = () => {
    this.setState(
      {
        video: this.videoAvailable,
        audio: this.audioAvailable,
      },
      () => {
        this.getUserMedia();
        this.connectToSocketServer();
      }
    );
  };

  getUserMedia = () => {
    if ((this.state.video && this.videoAvailable) || (this.state.audio && this.audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: this.state.video, audio: this.state.audio })
        .then(this.getUserMediaSuccess)
        .catch((e) => console.log(e));
    } else {
      try {
        let tracks = this.localVideoref.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      } catch (e) {}
    }
  };

  getUserMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              video: false,
              audio: false,
            },
            () => {
              try {
                let tracks = this.localVideoref.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
              } catch (e) {
                console.log(e);
              }

              let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
              window.localStream = blackSilence();
              this.localVideoref.current.srcObject = window.localStream;

              for (let id in connections) {
                connections[id].addStream(window.localStream);

                connections[id].createOffer().then((description) => {
                  connections[id]
                    .setLocalDescription(description)
                    .then(() => {
                      socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                    })
                    .catch((e) => console.log(e));
                });
              }
            }
          );
        })
    );
  };

  getDislayMedia = () => {
    if (this.state.screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(this.getDislayMediaSuccess).catch((e) => console.log(e));
      }
    }
  };

  getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    this.localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketId) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socket.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          this.setState(
            {
              screen: false,
            },
            () => {
              try {
                let tracks = this.localVideoref.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop());
              } catch (e) {
                console.log(e);
              }

              let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
              window.localStream = blackSilence();
              this.localVideoref.current.srcObject = window.localStream;

              this.getUserMedia();
            }
          );
        })
    );
  };

  gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

    if (fromId !== socketId) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === 'offer') {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socket.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch((e) => console.log(e));
      }
    }
  };

  connectToSocketServer = () => {
    socket = io.connect(server_url, { secure: true });

    socket.on('signal', this.gotMessageFromServer);

    socket.on('connect', () => {
      socket.emit('join-call', window.location.href);
      socketId = socket.id;

      socket.on('chat-message', this.addMessage);

      socket.on('user-left', (id) => {
        let video = document.querySelector(`[data-socket="${id}"]`);
        if (video !== null) {
          video.parentNode.removeChild(video.parentNode);
        }
        // Add system message to indicate user has left
        this.addMessage(`${id} has left the chat`, 'System', socketId);
        // Optional: Update users list if tracking active users
        // this.setState((prevState) => ({
        //   users: prevState.users.filter((user) => user.id !== id),
        // }));
      });

      socket.on('user-joined', (id, clients) => {
        // Optional: Add user to users list if tracking active users
        // this.setState((prevState) => ({
        //   users: [...prevState.users, { id, username: `User-${id}` }],
        // }));
        // Add system message for new user
        this.addMessage(`${id} has joined the chat`, 'System', socketId);

        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(peerConnectionConfig);
          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socket.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
            }
          };

          connections[socketListId].onaddstream = (event) => {
            let searchVidep = document.querySelector(`[data-socket="${socketListId}"]`);
            if (searchVidep !== null) {
              searchVidep.srcObject = event.stream;
            } else {
              let main = document.getElementById('main');
              let videoContainer = document.createElement('div');
              videoContainer.className = 'video-container';
              let video = document.createElement('video');
              video.setAttribute('data-socket', socketListId);
              video.srcObject = event.stream;
              video.autoplay = true;
              video.playsinline = true;
              videoContainer.appendChild(video);
              main.appendChild(videoContainer);
            }
          };

          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) => new MediaStream([this.black(...args), this.silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketId) {
          for (let id2 in connections) {
            if (id2 === socketId) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socket.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription }));
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  handleVideo = () => this.setState({ video: !this.state.video }, () => this.getUserMedia());
  handleAudio = () => this.setState({ audio: !this.state.audio }, () => this.getUserMedia());
  handleScreen = () => this.setState({ screen: !this.state.screen }, () => this.getDislayMedia());

  handleEndCall = () => {
    try {
      let tracks = this.localVideoref.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = '/';
  };

  openChat = () => this.setState({ showModal: true, newmessages: 0 });
  closeChat = () => this.setState({ showModal: false });
  handleMessage = (e) => this.setState({ message: e.target.value });

  addMessage = (data, sender, socketIdSender) => {
    this.setState((prevState) => ({
      messages: [...prevState.messages, { sender: sender, data: data }],
    }));
    if (socketIdSender !== socketId) {
      this.setState({ newmessages: this.state.newmessages + 1 });
    }
  };

  handleUsername = (e) => this.setState({ username: e.target.value });

  sendMessage = () => {
    socket.emit('chat-message', this.state.message, this.state.username);
    this.setState({ message: '', sender: this.state.username });
  };

  copyUrl = () => {
    let text = window.location.href;
    if (!navigator.clipboard) {
      let textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        message.success('Link copied to clipboard!');
      } catch (err) {
        message.error('Failed to copy');
      }
      document.body.removeChild(textArea);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        message.success('Link copied to clipboard!');
      },
      () => {
        message.error('Failed to copy');
      }
    );
  };

  connect = () => this.setState({ askForUsername: false }, () => this.getMedia());

  isChrome = function () {
    let userAgent = (navigator && (navigator.userAgent || '')).toLowerCase();
    let vendor = (navigator && (navigator.vendor || '')).toLowerCase();
    let matchChrome = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null;
    return matchChrome !== null;
  };

  render() {
    if (!this.isChrome()) {
      return (
        <div style={{ background: 'white', width: '30%', height: 'auto', padding: '20px', minWidth: '400px', textAlign: 'center', margin: 'auto', marginTop: '50px' }}>
          <h1>Sorry, this works only with Google Chrome</h1>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {this.state.askForUsername ? (
          <>
            <Paper elevation={3} style={{ width: '30%', minWidth: '400px', padding: '20px', margin: '50px auto', textAlign: 'center' }}>
              <Typography variant="h6" style={{ marginBottom: '20px' }}>Set your username</Typography>
              <TextField
                label="Username"
                variant="outlined"
                value={this.state.username}
                onChange={this.handleUsername}
                style={{ marginBottom: '20px' }}
              />
              <Button variant="contained" color="primary" onClick={this.connect}>Connect</Button>
            </Paper>
            <div style={{ justifyContent: 'center', textAlign: 'center', paddingTop: '40px' }}>
              <video
                ref={this.localVideoref}
                autoPlay
                muted
                style={{ border: '1px solid #bdbdbd', objectFit: 'fill', width: '400px', height: '250px' }}
              ></video>
            </div>
          </>
        ) : (
          <>
            <Paper 
              elevation={3}
              style={{ 
                padding: '20px', 
                margin: '20px auto', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: '#ffffff', 
                borderRadius: '12px', 
                maxWidth: '600px', 
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)' 
              }}
            >
              <Typography 
                variant="h5" 
                style={{ 
                  marginBottom: '15px', 
                  fontWeight: '500', 
                  color: '#333' 
                }}
              >
                Share this link to invite others
              </Typography>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <TextField
                  value={window.location.href}
                  InputProps={{ 
                    readOnly: true,
                    style: { fontSize: '14px', color: '#555' }
                  }}
                  variant="outlined"
                  size="small"
                  style={{ 
                    flexGrow: 1, 
                    marginRight: '10px', 
                    backgroundColor: '#f9f9f9', 
                    borderRadius: '8px' 
                  }}
                />
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={this.copyUrl}
                  style={{ 
                    padding: '8px 20px', 
                    borderRadius: '8px', 
                    textTransform: 'none', 
                    fontWeight: 'bold' 
                  }}
                >
                  Copy
                </Button>
              </div>
            </Paper>
            <div id="main" className="video-grid" style={{ flexGrow: 1 }}>
              <div className="video-container">
                <video ref={this.localVideoref} autoPlay muted></video>
              </div>
            </div>
            <AppBar position="fixed" color="default" style={{ bottom: 0, top: 'auto' }}>
              <Toolbar>
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <Tooltip title={this.state.video ? 'Turn off camera' : 'Turn on camera'}>
                    <IconButton onClick={this.handleVideo}>
                      {this.state.video ? <VideocamIcon /> : <VideocamOffIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="End call">
                    <IconButton onClick={this.handleEndCall} color="secondary">
                      <CallEndIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={this.state.audio ? 'Mute audio' : 'Unmute audio'}>
                    <IconButton onClick={this.handleAudio}>
                      {this.state.audio ? <MicIcon /> : <MicOffIcon />}
                    </IconButton>
                  </Tooltip>
                  {this.state.screenAvailable && (
                    <Tooltip title={this.state.screen ? 'Stop sharing screen' : 'Share screen'}>
                      <IconButton onClick={this.handleScreen}>
                        {this.state.screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Badge badgeContent={this.state.newmessages} color="secondary">
                    <Tooltip title="Open chat">
                      <IconButton onClick={this.openChat}>
                        <ChatIcon />
                      </IconButton>
                    </Tooltip>
                  </Badge>
                </div>
              </Toolbar>
            </AppBar>
            <Dialog open={this.state.showModal} onClose={this.closeChat} fullWidth maxWidth="sm">
              <DialogTitle>Chat Room</DialogTitle>
              <DialogContent dividers style={{ height: '400px', overflowY: 'auto' }}>
                {/* Optional: Display active users */}
                {/* {this.state.users.length > 0 && (
                  <Typography variant="subtitle2" style={{ marginBottom: '10px' }}>
                    Active Users: {this.state.users.map((user) => user.username).join(', ')}
                  </Typography>
                )} */}
                {this.state.messages.length > 0 ? (
                  this.state.messages.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        textAlign: item.sender === this.state.username ? 'right' : 'left',
                        marginBottom: '10px',
                        color: item.sender === 'System' ? '#888' : '#000', // Style system messages differently
                      }}
                    >
                      <Typography>
                        <b>{item.sender}</b>: {item.data}
                      </Typography>
                    </div>
                  ))
                ) : (
                  <Typography>No messages yet</Typography>
                )}
              </DialogContent>
              <DialogActions>
                <TextField placeholder="Message" value={this.state.message} onChange={this.handleMessage} fullWidth />
                <Button variant="contained" color="primary" onClick={this.sendMessage}>Send</Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </div>
    );
  }
}

export default Video;