
class Player {
  volume;
  guild;
  textChannel;
  voiceChannel;
  manager;
  voiceState;
  
  constructor(options, manager){
    this.guild = options.guild;
    this.voiceChannel = options.voiceChannel;
    this.manager = manager;
    this.voiceState = {
      op: 'voiceUpdate',
      guildId: this.guild.id
    }
    this.setVolume(100)
  }
  
  connect() {
    this.guild.shard.send({
      op: 4,
      d: {
        guild_id: this.guild.id,
        channel_id: this.voiceChannel,
        self_mute: false,
        self_deaf: true,
            
      }
    })
  }
  disconnect() {
    this.guild.shard.send({
      op: 4,
      d: {
        guild_id: this.guild.id,
        channel_id: null,
        self_mute: false,
        self_deaf: true,
            
      }
    })
  }
  updateState() {
    this.manager.send(this.voiceState)
  }
  play() {
    const options = {
            op: "play",
            guildId: this.guild.id,
            track
        };
    
    this.manager.send(options) 
  }
  setVolume(volume) {
    this.manager.send({
            op: "volume",
            guildId: this.guild.id,
            volume: volume,
        });
    return this;
  }
}

module.exports = Player