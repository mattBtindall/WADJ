'use strict';

const Global = (function() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();

    let mix; // -- This holds the main object that holds all the track information -- // 

    const sampleRate = context.sampleRate;

    const mixMode = 'warmUp';
    
    const maxBpm = 145,
        minBpm = 90;

    const tracks = [],
        trackNo = 0,
        crossfadeStartPos = 0;

    const fileType = '.wav';


    const maxSampInterval = Math.round(sampleRate/(maxBpm/60)),
        minSampInterval = Math.round(sampleRate/(minBpm/60));

    const BPMs = [];

    function playSound(buffer, offSet) {
        const source = Global.context.createBufferSource(); 
        source.buffer = buffer;                   
        source.connect(Global.context.destination);     
        source.start(0,offSet);                           
    }

    // power is the factor to round to
    const round = (value,power) => Math.round( value * power ) / power; // ie.. power= 1e5 is to nearest 5th place
    

    const convert = {  
        samplesToBins: (samples, fftSize) => Math.floor(samples / fftSize),

        binToSamples: (binNo, fftSize) => binNo * fftSize,

        samplesToSeconds: (samples) => parseFloat((samples / sampleRate).toFixed(3)),

        secondsToSamples: (seconds) => seconds * sampleRate,

        secondsToMinutes: (time) => {
            let minutes = Math.floor(time / 60);
            let seconds = time - minutes * 60;
            return minutes.toString()+'.'+seconds.toFixed(2).toString();
        }
    }

    const scaleValueInRange = function(x,oMin,oMax,nMax,nMin) { 
    // Formula: scaledX = ((x − oMin) / (oMax − oMin)) x (nMax - nMin) + nMin
        // o = original, n = new;
        return ((x - oMin) / (oMax - oMin)) * (nMax - nMin) + nMin;
    } 

     // Define the duration type depending on the length of the track
    const durationTypes = { // in seconds
        // Multiplier for this is stored in Track.offSetMultiplier
        short: 180,    // 3:00 mins // Jump forward 8 bars  // 16 bars for crossfade period
        medium: 270,   // 4:30 mins // Jump forward 16 bars // 32 bars for crossfade period
        long: 360,     // 6:00 mins // Jump forward 24 bars // 48 bars for crossfade period
        xLong: 480     // 8:00 mins // Jump forward 32 bars // 64 bars for crossfade period
    }
    
    const highestNumbers = function(buffer, noToReturn) {
        const sortNumber = function(a,b) {
            return a - b;
        }
    
        buffer.sort(sortNumber);
        return buffer.slice(buffer.length-noToReturn, buffer.length);
    }

    return {
        maxBpm,
        sampleRate,
        maxSampInterval,
        minSampInterval,
        BPMs,
        fileType,
        context,
        durationTypes,
        tracks, 
        highestNumbers,
        convert,
        scaleValueInRange,
        trackNo,
        mixMode,
        crossfadeStartPos,
        playSound, 
        mix,
        round
    }
}());

document.querySelector('button').addEventListener('click', function() {
    Global.context.resume().then(() => {
        console.log('Playback resumed successfully');
    });
});

// const allTrackURLs = [{name: 'RawCuts'},
//                 {name: 'EveryDayOfMyLife'},
//                 {name: 'DubelleOhXX'},
//                 {name: 'EtherealEducation'},
//                 {name: 'ComeFlyAway'},
//                 {name: 'FrozenRoom'},
//                 {name: 'Ex'},
//                 {name: 'Joyenergizer'},
//                 {name: 'Discovery'},
//                 {name: 'BasslineJunkie'},
//                 {name: 'Arizona'},
//                 {name: 'Dusty'},
//                 {name: 'TEX'},
//                 {name: 'Fratello'},
//                 {name: 'EXposed'},
//                 {name: 'GoodTimes'},
//                 {name: 'WhenIsNow'},
//                 {name: 'NoEyes'},
//                 {name: 'InspectorNorse'}]
//                 // {name: 'SalvaMea2.0', BPM: 128}];

const allTrackURLs = [{name: 'SalvaMea2.0'}];
