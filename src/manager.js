const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { Collection } = require('discord.js');
const Player = require('./Player');

class Manager extends EventEmitter {
  clientId;
  reconnectTimeout;
  stats;
  address;
  players = new Collection();

  constructor({ host, port, password, clientId }) {
    super();
    this.clientId = clientId;
    this.host = host;
    this.port = port;
    this.password = password;
    this.socket = null;
  }

  get isConnect() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.isConnect) return;
    const headers = {
      Authorization: this.password,
      'Num-Shards': '1',
      'User-Id': this.clientId,
      'Client-Name': 'Joako',
    };
    this.socket = new WebSocket(`ws://${this.host}:${this.port}`, { headers });
    this.socket.on('open', () => this.open());
    this.socket.on('close', (code, reason) => this.close(code, reason));
    this.socket.on('message', (msg) => this.message(msg));
    this.socket.on('error', (err) => this.error(err));
  }

  reconnect() {
    if (this.isConnect) return;
    this.reconnectTimeout = setTimeout(() => {
      this.emit('nodeReconnect', this);
      this.connect();
    }, 5000);
  }

  open() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.emit('nodeConnect', this);
  }

  close(code, reason) {
    this.emit('nodeDisconnect', this, { code, reason });
    if (code !== 1000 || reason !== 'destroy') this.reconnect();
  }

  message(msg) {
    if (Array.isArray(msg)) msg = Buffer.concat(msg);
    else if (msg instanceof ArrayBuffer) msg = Buffer.from(msg);

    const payload = JSON.parse(msg.toString());
    
    switch (payload.op) {
      case 'ready':
        this.emit('nodeReady', payload.resumed, payload.sessionId);
        break;
      case 'stats':
        this.stats = { ...payload };
        break;
      case 'event':
        this.eventHandlers(payload);
        break;
      default:
        this.emit('nodeError', payload.op, payload);
    }
  }

  error(err) {
    console.error(err);
  }

  eventHandlers(payload) {
    if (!payload.guildId) return;
    switch (payload.type) {
      case 'TrackStartEvent':
        // Manejo de inicio de pista
        break;
      case 'TrackEndEvent':
        // Manejo de fin de pista
        break;
      case 'TrackExceptionEvent':
        // Manejo de excepción de pista
        break;
      case 'TrackStuckEvent':
        // Manejo de atasco de pista
        break;
      case 'WebSocketClosedEvent':
        // Manejo de cierre de WebSocket
        break;
      default:
        this.emit('eventError', payload.type, payload);
    }
  }
  
  async create(options) {
    if (this.players.has(options.guild.id)) return this.players.get(options.guild.id);
    else {
      const newPlayer = new Player(options, this);
      this.players.set(options.guild.id, newPlayer);
      return newPlayer;
    }
  }
  
  getPlayer(guild) {
    return this.players.get(guild);
  }
  
  remove(guild) {
    this.players.delete(guild)
  }
  
  async search(query, request) {
    try {
      const res = await fetch(`http://${this.host}:${this.port}/loadtracks?identifier=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          Authorization: this.password
        }
      });
      
      if (!res.ok || res.status !== 200) throw new Error("Query not found.");
      
      const json = await res.json();
      
      if (json.loadType === 'NO_MATCHES' || json.loadType === 'LOAD_FAILED') {
        const res2 = await fetch(`http://${this.host}:${this.port}/loadtracks?identifier=${encodeURIComponent(`ytsearch:${query}`)}`, {
          method: 'GET',
          headers: {
            Authorization: this.password
          }
        });
        
        if (!res2.ok || res2.status !== 200) throw new Error("Query not found.");
        
        const json2 = await res2.json();
        
        if (json2.loadType === 'PLAYLIST_LOADED') {
          return json2.tracks.map(trackData => this.getTrack(trackData, request));
        } else if (json2.tracks.length >= 1) {
          return this.getTrack(json2.tracks[0], request);
        } 
      } else {
        if (json.loadType === 'PLAYLIST_LOADED') {
          return json.tracks.map(trackData => this.getTrack(trackData, request));
        } else if (json.tracks.length >= 1) {
          return this.getTrack(json.tracks[0], request);
        } 
      }
      
      throw new Error("Query not found.");
    } catch (err) {
      return err.message || err
    }
  }
  
  getTrack(data, request) {
    return {
      track: data.track,
      title: data.info.title,
      identifier: data.info.identifier,
      author: data.info.author,
      duration: data.info.length,
      isSeekable: data.info.isSeekable,
      isStream: data.info.isStream,
      uri: data.info.uri,
      thumbnail: data.info.uri.includes("youtube")
        ? `https://img.youtube.com/vi/${data.info.identifier}/default.jpg`
        : null,
      displayThumbnail(size = "default") {
        const finalSize = ["default", "medium", "high"].includes(size) ? size : "default";
        return this.uri.includes("youtube")
          ? `https://img.youtube.com/vi/${data.info.identifier}/${finalSize}.jpg`
          : null;
      },
      request
    };
  }
  
  send(data) {
        return new Promise((resolve, reject) => {
          if (!this.isConnect) {
            return resolve(false);
          }
            this.socket.send(JSON.stringify(data), (error) => {
                if (error)
                    reject(error);
                else
                    resolve(true);
            });
        });
    }
    
  update({ t, d }) {
    if (!t || (t !== 'VOICE_STATE_UPDATE' && t !== 'VOICE_SERVER_UPDATE')) return;
    
    if (!d && d.guild_id) return;
    
    const player = this.getPlayer(d.guild_id);
    if (!player) return;
    
    if (d.token) {
      
      player.voiceState.event = d;
    } else {
      if (d.user_id !== this.clientId) {
        return;
      }
      if (!d.session_id) return;
      player.voiceState.sessionId = d.session_id;
    }
    
    if (player.voiceState.event) {
      player.updateState();
    }
  }
}

module.Manager = Manager

