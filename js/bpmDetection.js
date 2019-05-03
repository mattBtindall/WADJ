'use strict';


// ------------------ BPM ------------------ // 

Track.prototype.setWebAudioFilteredBuffer = function(buffer, url) {
    // Create offlineContext so tracks can be rendered without playing
    const offlineContext = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;

    const lpfCutOff = 350,
    hpfCutOff = 150;

    const createFilter = function(context, type, freq) {
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        return filter;
    }

    const HPF1 = createFilter(offlineContext, "highpass", hpfCutOff),
        LPF1 = createFilter(offlineContext, "lowpass", lpfCutOff),
        LPF2 = createFilter(offlineContext, "lowpass", lpfCutOff),
        LPF3 = createFilter(offlineContext, "lowpass", lpfCutOff),
        LPF4 = createFilter(offlineContext, "lowpass", lpfCutOff),
        LPF5 = createFilter(offlineContext, "lowpass", lpfCutOff);

    source.connect(HPF1);
    HPF1.connect(LPF1);
    LPF1.connect(LPF2);
    LPF2.connect(LPF3);
    LPF3.connect(LPF4);
    LPF4.connect(LPF5);
    LPF5.connect(offlineContext.destination);
    source.start(0);
    offlineContext.startRendering();

    offlineContext.oncomplete = e => {
        console.log(`${this.name} detecting BPM`);
        this.webAudioFilteredbuffer = e.renderedBuffer.getChannelData(0);
        Global.playSound(e.renderedBuffer,0)
        // const threshold = this.getThreshold();
        // const temp = this.getBPM(threshold); // W full buffer
        // if (temp) { // If BPM is defined
        //     this.bpm = temp.roundedBpm;
        //     //this.setToneFilteredBuffer();
        // } 
    };
}

Track.prototype.getThreshold = function( )
{
    const addAllVals = function(prev, cur) {
        return prev + cur;
    }

    const getHighestLevels = offSet => {
        // Gets 5/6 segments split up evenly over a period which is set by offSet
        const chunkSize = Global.minSampInterval*4; // A bar at the slowest BPM 
        const range = Math.floor(this.webAudioFilteredbuffer.length/5),
            incrementer = Math.floor(range/5);
        const segments = [],
            highestVals = [];
        
        for (let i = offSet; i < (range+offSet); i+=incrementer) {
            segments.push(this.webAudioFilteredbuffer.slice(i,i+chunkSize));
        }

        segments.forEach((seg,i) => {
            highestVals[i] = Global.highestNumbers(seg,20);
        });
        return highestVals;
    }

    const averagesTemp = [];
    const startSegments  = getHighestLevels(0);
    startSegments.forEach(seg => {
        averagesTemp.push(seg.reduce(addAllVals)/20);
    });
    const theAverage = averagesTemp.reduce(addAllVals)/averagesTemp.length;
    return theAverage/1.6;
}

Track.prototype.getBPM = function(threshold) {
    let matched = 0;
    const peaks = this.getPeaksAtThreshold(threshold); 

    if (peaks.length !== 0) {
        const intervalCounts = this.countIntervalsBetweenPeaks(peaks);
        const groupedIntervals = this.groupIntervalsByMultiples(intervalCounts);
        // sort in size order
        groupedIntervals.sort(function(a, b) {
            return b.count - a.count;
        });
        
        if (groupedIntervals) {
            const sampTime = 1/Global.sampleRate;
            const bpm = 60 / (groupedIntervals[0].interval * sampTime);
            const roundedBpm = Math.round(bpm);
            return {
                roundedBpm
            };
        }
    }
}

Track.prototype.getPeaksAtThreshold = function(threshold) {
    const peaksArray = [];
    for (let i = 0; i < this.webAudioFilteredbuffer.length; i++) {
        if (this.webAudioFilteredbuffer[i] > threshold) {
            peaksArray.push(i);
            // Skip forward less than one beat
            i += Global.maxSampInterval;
        }
    }
    return peaksArray;
}

Track.prototype.countIntervalsBetweenPeaks = function(peaks) {
    const intervalCounts = [];
    peaks.forEach((peak, index) => {
        for (let i = 0; i < 10; i++) {
            const interval = peaks[index + i] - peak;
            const foundInterval = intervalCounts.some(function(intervalCount) {
                if (intervalCount.interval === interval)
                    return intervalCount.count++;
            });
            if (!foundInterval) {
                intervalCounts.push({
                    interval: interval,
                    count: 1
                });
            }
        }
    });
    return intervalCounts;
}

Track.prototype.groupIntervalsByMultiples = function(intervalCounts) {
    const {maxSampInterval, minSampInterval} = Global;
    intervalCounts.forEach(outOfRangeInterval => {
        if (outOfRangeInterval.interval < maxSampInterval || outOfRangeInterval.interval > minSampInterval) {
            intervalCounts.forEach(inRangeInterval => {
                if (inRangeInterval.interval > maxSampInterval && inRangeInterval.interval < minSampInterval) {
                    const remainder = outOfRangeInterval.interval % inRangeInterval.interval;
                    if (!remainder) {
                        inRangeInterval.count += outOfRangeInterval.count;
                        outOfRangeInterval.count = 0;                        
                    }
                }
            });
        }
    });
    return intervalCounts;
}

// ------------------ END ------------------ // 