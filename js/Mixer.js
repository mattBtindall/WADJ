'use strict';

class Mixer {
    constructor() {
        this.mixMode = Global.mixMode;
        this.tracks = [];
        this.crossFader;
        this.currentTrack = 0;

        this.setTracks();
        // this.setMix();
    } 
}

Mixer.prototype.setTracks = function() {
// Create tracks
    allTrackURLs.forEach((trackSpec) => {
        this.tracks.push(new Track(trackSpec));
    });
}

// Set Sequence of tracks
Mixer.prototype.setMix = function() {
// Every second check to see if all cue points have been read
    // if values have been read then set tracks in correct order
    const intervalId = setInterval(() => {
        if (Global.trackNo === allTrackURLs.length) {
            // var a = console.timeEnd('mixer'); 
            console.log('All Tracks Loaded');
            clearInterval(intervalId);
            this.setTrackSequence();
            this.setAdjustTempo();
            this.tracksLoaded();
            this.connectToCrossFader();

            // // play track and schedule next track to play
            Tone.Transport.start(0);
            this.tracks[0].player.start(0,this.tracks[0].cues.start);
            this.scheduleNextTrack();
        }
    },1000); 
}

Mixer.prototype.scheduleNextTrack = function() {
// Schedules next track to play
    let stopFlag = false;
    // if (this.currentTrack.trackNo === this.tracks.length-1) stopFlag = true;
    if (this.currentTrack === this.tracks.length-1) stopFlag = true;
    let timeUntilNextTrack = Tone.now()+this.tracks[this.currentTrack].timeUntilNextTrack;
    // timeUntilNextTrack = Math.round( timeUntilNextTrack * 1e5 ) / 1e5; // round to .

    // Schedule the next event
    if (!stopFlag) {
        Tone.Transport.scheduleOnce((time) => {
            console.log(`currentTrackNo: ${++this.currentTrack}`); // increment track
            this.tracks[this.currentTrack].player.start(time,this.tracks[this.currentTrack].cues.start);
            let temp;
            if (this.crossFader.fade.value === 0) temp = 1
            else temp = 0;
            this.crossFader.fade.rampTo(temp,this.tracks[this.currentTrack].transitions.level);
            Tone.Transport.scheduleOnce((time) => {
                console.log('fully transitioned');
                this.tracks[this.currentTrack].player.playbackRate = 1;
            },Tone.now()+this.tracks[this.currentTrack].transitions.level);
            this.scheduleNextTrack();
        }, timeUntilNextTrack);
    }
}

Mixer.prototype.tracksLoaded = function() {
// Called once all initialisation is complete
    Tone.setContext(Global.context);     // Sets context back to the online context
    this.tracks.forEach((track,i) => {   // Create players all at once to avoid issues with the context
        track.trackNo = i;
        track.loaded();
    });
}

Mixer.prototype.setTrackSequence = function() {
// Sets sequence of tracks corresponding to the mixMode
    if (this.mixMode !== 'shuffle') {
        let sortCal = 0;
        this.tracks.sort((a, b) => { 
            if (this.mixMode === 'warmUp')
                sortCal = a.bpm - b.bpm
            else if (this.mixMode === 'warmDown') 
                return b.bpm - a.bpm; // Warm down
            return sortCal;
        });
    }
    else if (this.mixMode === 'shuffle') {
        this.yatesShuffle();
    } 
    else {
        alert('Incorrect Mode Entered');
    }
}

Mixer.prototype.yatesShuffle = function() {
// Fisher Yates Shuffle algorithm
    let i = this.tracks.length,
        j,                                      // random number that we generate each loop
        temp;                                   // holds temp value when swapping

    while (--i > 0) {
        j = Math.floor(Math.random() * (i+1));  // random number inbtween 0 and i
        // Swapping of two values
        temp = this.tracks[j];                  // get j's value
        this.tracks[j] = this.tracks[i];        // swap the value from random index to index pos in loop
        this.tracks[i] = temp;
    }
}

Mixer.prototype.setAdjustTempo = function() {
// Adjust tempo to previous track
    let playbackRate = 1;
    this.tracks.forEach((track,i,arr) => {
        if (i !== 0) { // if not first track
            if (track.bpm === arr[i-1]) // if the playbackRate is equal no tempo adjustments
                playbackRate = 1;
            else {
                playbackRate = arr[i-1].bpm / track.bpm
            }
        }
        track.playbackRate = playbackRate;
    });
}

Mixer.prototype.connectToCrossFader = function() {
// connects each track to the opposite side of the crossfader
    this.crossFader = new Tone.CrossFade(Global.crossfadeStartPos).toMaster();
    this.tracks.forEach((track,i) => {
        // if odd number connect to point A
        // if even numver connect to point B
        track.player.connect(this.crossFader,0,i % 2);
    });
    // this.crossFader.fade.rampTo(1,5);
    console.log('crossfade done');
}