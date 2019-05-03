'use strict';
let trackCount = 0;

// Prototype/Class Creation with General functions

class Track {
    constructor(trackSpec) {
        const { name } = trackSpec;
         // -- Declare member variables -- 
        // Clear list of all varialbes associated with this Class
        // Audio based variables
        this.buffer;
        this.toneFilteredBuffer;        // Buffer filtered by Tones filters
        this.webAudioFilteredBuffer;    // Buffer filtered with web audio biquad filter
        this.player;
        this.playbackRate;

        // Utility based variables
        this.trackNo;
        this.processingFilterParams; // Parameters used to set the filters for Tones filters
        this.duration;
        this.measures;
        this.cues = {};
        this.offSetMultiplier;
        this.name = name;
        this.bpm;
        this.found; 
        this.measures = {};
        this.transitions = {};
        this.filters = [];
        this.timeUntilNextTrack;

        this.initialize();
    }

    initialize() {
        this.loadSound();  

        this.processingFilterParams = {
            cutOff: [350,50],
            type: ['lowpass','highpass'],
            rollOff: [-48,-12]
        };
    }
}

Track.prototype.loadSound = function() {
    const url = `NormalizedSampleTracks/${this.name}${Global.fileType}`;
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';

    request.onload = () => { // Due to use of Arrow functions no need to bind
        Global.context.decodeAudioData(request.response, buffer => {
            this.initializeBufferParams(buffer);
            this.setWebAudioFilteredBuffer(buffer,url);
        });
    };
    request.send();
}

Track.prototype.initializeBufferParams = function(buffer) {
// Once buffer has loadded initilaize params that require the buffer attributes
    this.buffer = buffer;
    this.duration = buffer.duration;
    this.offSetMultiplier = this.getDurationType();
}

Track.prototype.setPlayer = function() {
    this.player = new Tone.Player(this.buffer, () => {
        console.log(`${this.trackNo}. ${this.name}: player loaded`);
    }); 
    this.player.playbackRate = this.playbackRate;
}

Track.prototype.loaded = function() {
// Function is called once cue points have loaded
    // Set time it takes to crossfade 
    this.transitions.level = Global.convert.samplesToSeconds(this.measures.offSet); 
    this.setTimeUntilNextTrack();
    this.setPlayer();
}

Track.prototype.setTimeUntilNextTrack = function() {
    const timeTakenForCrossfadePeriod = this.transitions.level * this.playbackRate,
        timeTakenForTestOfTrack = this.cues.end - (this.cues.start+timeTakenForCrossfadePeriod);
    this.timeUntilNextTrack = timeTakenForCrossfadePeriod + timeTakenForTestOfTrack;
}

Track.prototype.chunkBuffer = function(buffer, chunkSize, offSet) { 
// outputs mutliDimen Array containing the chunked buffers
    const chunks = [];
    for (let i = offSet; i < buffer.length; i+=chunkSize) {
        const chunk = buffer.slice(i,i+chunkSize);

        if (chunk.length === chunkSize) 
            chunks.push(chunk);
    }
    return chunks;
}
    
Track.prototype.setFFT = function(chunks, fftSize) {
// Outputs FFT data as object which contains chunked data and unchunked data
    const fft = new FFT(fftSize, Global.sampleRate);
    const unChunkedWindow = [];
    let noOfFFTBins = fftSize/2;
    chunks.forEach(chunk => {
        fft.forward(chunk);
        const fftd = fft.spectrum;
        fftd.forEach(fftdI => {unChunkedWindow.push(fftdI);});
    });

    const chunkedWindow = this.chunkBuffer(unChunkedWindow,noOfFFTBins,0); // Rechunks FFT data
    return {
        chunkedWindow,
        unChunkedWindow
    };
}

Track.prototype.getDurationType = function() {
// Returns a number used to multiply by 8 bars, the longer the track the higher the number
    // see Global.durationTimes
    const duration = this.duration;
    const { short, medium, long, xLong} = Global.durationTypes;
    let multiplier;

    const between = function(x, min, max) {
        return x >= min && x <= max;
    }

    if (between(duration,0,short))
        multiplier = 0;
    else if (between(duration,short,medium))
        multiplier = 1;
    else if (between(duration,medium,long))
        multiplier = 2;
    else if (between(duration,long,xLong))
        multiplier = 3;
    else if (between(duration,xLong,Infinity))
        multiplier = 4;

    return multiplier;
}

Track.prototype.nameExtractor = function(str) {
// Extracts name form URL
    const temp = str.indexOf('/')+1,
        length = str.length - Global.fileType.length;

    return str.substring(temp,length);
}

Track.prototype.setMax = function(buffer) {
// Gets max value from array
    let max = 0;
    buffer.forEach(sample => {
        if (sample > max) 
            max = sample;
    });
    return max;
}

Track.prototype.setMin = function(buffer) {
// Get minimum value from array
    let min = 0;
    buffer.forEach(sample => {
        if (sample < min)
            min = sample    
    });
    return min;
}


// Track.prototype.transistionPlaybackRate = function() {
// // smoothly transition from the current playbackRate to 1
//     // do this becuase .playbackRate is not an audioParam therefore can't use rampTo
//     const factor = (this.getPlaybackRate % 1) / this.transitions.tempo;
//     const operators = {
//         decrement: val => val-=factor,
//         increment: val => val+=factor
//     }

//     let temp; // if factor is bigger than 1 then decrement
//     if (factor < 1) temp = operators.decrement;
//     else temp = operators.increment;
    
//     let timeoutCounter = 0;
//     const timeoutId = setInterval(() => {
//         if (timeoutCounter < this.transitions.tempo) {
//             this.player.playbackRate = temp(this.player.playbackRate);
//             ++timeoutCounter;
//         }
//         else {
//             clearInterval(timeoutId);
//             this.player.playbackRate = Math.round(this.player.playbackRate);
//         }
//     },500);
// }