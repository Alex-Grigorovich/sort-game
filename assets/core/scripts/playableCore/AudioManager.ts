import { _decorator, AudioClip, AudioSource, Component, tween } from 'cc';

const { ccclass } = _decorator;
import super_html_playable from './super_html_playable';
import { property } from './property';
@ccclass('AudioManager')
export class AudioManager extends Component {
     public static instance: AudioManager;




     @property({ type: AudioSource, group: "Audio sources" })
     private _soundSource: AudioSource = null!;

     @property({ type: AudioSource, group: "Audio sources" })
     private _musicSource: AudioSource = null!;

     private _soundBuffer: Set<AudioClip> = new Set();


     @property({ type: AudioClip, group: "Audio clips" })
     public gameEndSound: AudioClip = null!;

     private muteOnStart: boolean = true;

     public smoothStopMusic() {
          tween(this._musicSource).to(1, { volume: 0 }).call(() => {
               this._musicSource.stop();
          }).start();
     }

     public playMusic() {
          if (this._musicSource.playing) return;
          this.muteOnStart = false;
          this._musicSource.play();
          console.log('playMusic');
     }

     public onSoundChange(status: boolean) {
          this._musicSource.volume = status ? 0.2 : 0;
          this._soundSource.volume = status ? 0.6 : 0;
     }


     public playSound(sound: AudioClip) {
          if (this.muteOnStart) {
             
               return;
          }
          if (!sound) return;


         this._soundSource.playOneShot(sound);
     }

     public playSoundWithBuffer(sound: AudioClip) {
          if (this.muteOnStart) {
             
               return;
          }
          if (!sound) return;


         this._soundBuffer.add(sound);
     }

     protected override onLoad(): void {
          AudioManager.instance = this;
          this.onSoundChange(super_html_playable.getAudioVolume() === 100);
          super_html_playable.setAudioCallback(this.onSoundChange.bind(this));


     }
     protected override start(): void {
          this.muteOnStart = super_html_playable.getMuteOnStart();
         
          if (!this.muteOnStart) {
               this.playMusic();
          }
     }
     protected override update(dt: number): void {
          this.processSoundBuffer();
     }

     private processSoundBuffer() {
          if (this._soundBuffer.size === 0) {
               return;
          }


          const soundsToPlay = Array.from(this._soundBuffer);
          this._soundBuffer.clear();


          soundsToPlay.forEach(sound => {
               if (sound && !this.muteOnStart) {
                    this._soundSource.playOneShot(sound);
               }
          });
     }







}


