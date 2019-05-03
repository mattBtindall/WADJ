'use strict';

// ------------------ Cue Point Location ------------------ // 

Track.prototype.setToneFilteredBuffer = function() {
    const { cutOff, type, rollOff } = this.processingFilterParams;
   
    // Create offlineContext so tracks can be rendered without playing
    const offlineContext = new OfflineAudioContext(1, this.buffer.length, this.buffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = this.buffer;

    // Utilise filters from Tone due to web audio filters adding an offset
    Tone.setContext(offlineContext);
    const lpfFilter = new Tone.Filter(cutOff[0],type[0],rollOff[0]);
    const hpfFilter = new Tone.Filter(cutOff[1],type[1],rollOff[1]);
    source.connect(lpfFilter);
    lpfFilter.connect(hpfFilter);
    hpfFilter.connect(offlineContext.destination);

    source.start(0);
    offlineContext.startRendering();

    offlineContext.oncomplete = e => {
        // console.log(`${this.name} detecting Cue Points`);
        this.toneFilteredBuffer = e.renderedBuffer;
        this.measures.oneBeat = Math.floor((60 * Global.sampleRate)/this.bpm);
        this.measures.eightBars = this.measures.oneBeat * 32;
        this.measures.offSet = this.measures.eightBars * this.offSetMultiplier;
        this.setCuePoints(); 
    }
}

Track.prototype.setCuePoints = function() {
    this.setStartCue();
    this.setEndCue();
    ++Global.trackNo;
}

// Start Cue

Track.prototype.setStartCue = function() {
    const fftSize = 512; // -- //
    let extractedBuffer = this.extractChunk(this.toneFilteredBuffer.getChannelData(0),0.25,0); // extract Start Chunk .25 of track

    const chunks = this.chunkBuffer(extractedBuffer,fftSize,0);
    let fftData = this.setFFT(chunks,fftSize);
    const thresholdStartVal = this.setGateThreshold(extractedBuffer,0);
    const energy = this.setEnergy(fftData.chunkedWindow, thresholdStartVal.gateThreshold,6); 
    const beatLocations = this.getPattern(energy,16,thresholdStartVal.startPoint,fftSize);//getPattern over 16 beats
    this.cues.start = this.getStartKick(beatLocations,fftSize)
}

Track.prototype.getStartKick = function(beatPattern,fftSize) { // HERE ME NOW
    const { binToSamples, samplesToSeconds } = Global.convert; // destructure
    const startPointSamples = binToSamples(beatPattern[0].location,fftSize) + this.measures.offSet;
    const startPoint = samplesToSeconds(startPointSamples);
    return startPoint;
}


Track.prototype.setGateThreshold = function(buffer, offSet) { 
    const getScaledSamples = offSet => {
        const beatSamples =[],
            maxValue = this.setMax(buffer), // Max value from whole track
            incrementor = Math.floor(this.measures.oneBeat/8);
        for (let i = offSet; i < (this.measures.eightBars-incrementor)+offSet; i+=incrementor) {  
            beatSamples.push(Global.scaleValueInRange(Math.abs(buffer[i]),0,maxValue,1,0));
        }
        return beatSamples;
    }

    const getEnergy = beatSamples => { // gets the overall energy to find minima
        let totalEnergy = 0,
            noOfQuitePoints = 0;
        beatSamples.forEach((sampPoint) => { 
            totalEnergy += sampPoint; 
            if (sampPoint < .05)      // Near 0 
                noOfQuitePoints++;
        });

        return {
            noOfQuitePoints,
            totalEnergy
        }
    }

    const getFluctuatingEnergy = beatSamples => { // Gets the difference in the peaks
    // This functions takes each sample and compares it to the rest of the samples in that beat
    // The result of this tells us the difference between level
    // If the level difference is big this tells us that there are peaks 
        let beatCount = 0,
            beatOffSet = 0,
            countPeak = 0;
        let differences = [];
        beatSamples.forEach((val,i,samples) => { 
            if (i !== 0 && i % 8 === 0) beatOffSet = ++beatCount * 8; // checks if new beat and sets offset
                
            for (let j = beatOffSet; j < (beatOffSet+8); j++) {
                const difference = Math.abs(val - samples[j]);
                if (difference !== 0 && difference >= .3) {  // if val hasn't minused from itself and over threshold
                    differences.push(difference);
                    countPeak++;
                }
            }
        });
        return countPeak;
    }

    const getCorrectSegment = offSet => { 
        let data;

        // ranges for theshold
        const oMin = 230,              // max value for amount of silence found
            oMax = 20,                 // min value for amount fo silence found
            nMin = 0.5,
            nMax = 0.95;

        const beatSamples = getScaledSamples(offSet);
        const energyData = getEnergy(beatSamples);
        const fluctuatingEnergy = getFluctuatingEnergy(beatSamples);

        if (fluctuatingEnergy < 50 && energyData.totalEnergy < 25) 
            data = undefined;
        else 
            data =  {
                startPoint: offSet,
                Threshold: Global.scaleValueInRange(energyData.noOfQuitePoints,oMin,oMax,nMax,nMin).toFixed(2)
            }
        return data;
    }

    // Loop until correct segment if found
    let  i = 0, data = undefined;
    do {
        data = getCorrectSegment(offSet);
        ++i;
        if (i === 1) offSet = this.measures.eightBars;
        else offSet += this.measures.eightBars;
    } while (!data);
    return data;
}

Track.prototype.setEnergy = function(chunks, threshold, binRange) { // If not work check BINRANGE GOT ADDED
// gets a total energy from given range of bins with gateing, any values under the threshold are seen as insignifacnt
    const totals = [];

    chunks.forEach(chunk => {
        let total = 0;
        for (let i = 0; i < binRange; i++) {
            total += chunk[i]; // Get energy
        }

        if (total < threshold) // Gate
            total = 0;
        totals.push(total);
    });
    return totals;
}

Track.prototype.getPattern = function(energyChunks,beatsInPattern,offSet,fftSize) {
    const { samplesToBins } = Global.convert;
    const beats = [],
        // finds total samples in minute, divides by BPM, then convert to bin
        beatInterval = samplesToBins((60 * Global.sampleRate)/this.bpm,fftSize),
        maxBeatRange = 14,
        threshold = 3; //
        
    let counter = 0,
        total = 0,
        beatTemp = 0;
        
    offSet = samplesToBins(offSet,fftSize);

    for (let i = offSet; i < energyChunks.length; i++) { 
        if (energyChunks[i] > 0) { // If there is energy found
            for (let j = i; j < i+maxBeatRange; j++) { // loop round till max size of beat
                if (energyChunks[j] > 0) { 
                    if (total === 0) { 
                        beatTemp = i; // Hold first value
                    }
                    total += energyChunks[j]; // Accumulate energy
                    counter = 0;                // Reset counter
                }
                if (energyChunks[j] === 0 && total !== 0) { // If no energy found start counter
                    // Do this because harsh gating may course gaps in the beat, yet it may still be the same beat
                    counter++;
                    if (counter === 4) { // only allow for a gap of 3
                        if (total < threshold) {
                            total = 0;
                        }
                        counter = 0;
                        break; // if more break from this loop and return to main loop
                    }
                }
            }
        }
        // check to see if total is similar to the last one 
        if (total > 0) {
            if (beats.length > 1) {
                const lastBeat = beats[beats.length-1].total;
                const difference = Math.abs(total - lastBeat);
                // take a percentage of the lastBeat for the difference > x; 
                
                if (difference > lastBeat*2) {// if there is a big difference leave loop and find new point
                    console.log(`${this.name}: ${difference}`);  
                    break;
                }
            }
            beats.push({
                location: beatTemp,
                total
            });
            total = 0;
            i += (beatInterval-1); // -1 becuase i will increment aswell // Go back to the start of the beat
        }
        if (beats.length >= beatsInPattern) break;
    }
    return beats;
}

// End Cue

Track.prototype.setEndCue = function() {
// Gets the energy peak then goes to the nearest multiple of 8
    const highEnergyPart = this.setLastEnergyPeak();
    this.goToNearestMultipleOfEight(highEnergyPart);
}

Track.prototype.setLastEnergyPeak = function() { 
    const fftSize = 2048; // -- // 
    const { secondsToSamples, samplesToBins, samplesToSeconds, binToSamples } = Global.convert;
    let slicedBuffer = this.toneFilteredBuffer.getChannelData(0).slice(secondsToSamples(this.cues.start),this.toneFilteredBuffer.length); // start from a high energy point

    const chunks = this.chunkBuffer(slicedBuffer,fftSize,0),
        fftData = this.setFFT(chunks,fftSize),
        energy = this.setEnergy(fftData.chunkedWindow,0,20), // Second arg is threshold of gate // 
        quitePeriod = samplesToBins(this.measures.oneBeat*4,fftSize);  //  Minimum period of Silence
    
    let highEnergyTotal = 0,
        highEnergyAverage = 0,
        highEnergyInc = 0;
    
    let hasDroppedBelow = false,
        droppedPoint = 0;


    let nearestEnergyIncrease = 0;

    energy.forEach((chunkEnergy,i) => { 
        if (i > 20) { // let energyAverage accumelate before testing
            if (chunkEnergy <= (highEnergyAverage * .5) && !hasDroppedBelow) {
                // Check the next 5 bins for peak values if there any then this isn't a quite part
                // Most likely just the quite part inbetween kicks
                let peakFlag = true;
                for (let j = i+1; j < i+6; j++) {
                    if (energy[j] >= highEnergyAverage) {
                        peakFlag = false;
                        break;
                    }
                }
                if (peakFlag) {
                    droppedPoint = i;
                    hasDroppedBelow = true;
                }
            }
        }
        
        if (!hasDroppedBelow) { 
            highEnergyTotal += chunkEnergy;
            highEnergyAverage = highEnergyTotal / ++highEnergyInc;
        } 
        else if (hasDroppedBelow) {
            // average over 10 bins is similar to the average
            if (chunkEnergy >= (highEnergyAverage-.1)) {
                let totalTemp = 0
                let averageTemp = 0;
                for (let j = i; j < (i+10); j++) {
                    totalTemp += energy[j];
                }
                averageTemp = totalTemp / 10;
                if (averageTemp >= (highEnergyAverage-.1)) {
                    if (i - droppedPoint > quitePeriod) {
                        const upPointSecs = samplesToSeconds(binToSamples(i,fftSize),fftSize);
                        nearestEnergyIncrease = parseFloat(upPointSecs)+parseFloat(this.cues.start);
                        // go to the closest multiple of eight
                    }
                    hasDroppedBelow = false;
                }
            }
        }
    });
    return nearestEnergyIncrease;
}

Track.prototype.goToNearestMultipleOfEight = function(startPoint) {
// Goes to the closest multiple of eight
    // See how many times eight bars goes into the startPoint then round down
    const { samplesToSeconds } = Global.convert;
    const eightBarsInSeconds = samplesToSeconds(this.measures.eightBars),
        bufferData = this.buffer.getChannelData(0),
        threshold = 0.06; // Excel Doc: "silenceAtBeginningOfTrack"
    const numberOfEightBars = Math.floor(startPoint/eightBarsInSeconds);

    // Look at the start of the track to see if there is any silence
    // this silence will offset the beat... 
    let temp;
    for (let i = 0; i < 22000; i ++) { // See when audio comes in
        if (Math.abs(bufferData[i]) >= threshold) { 
            temp = i;
            break;
        }
    }
       
    let offSet = samplesToSeconds(temp); // Convert to seconds
    if (offSet < 0.00001)
        offSet = 0;
    // const endCue = (numberOfEightBars * eightBarsInSeconds) + offSet;
    this.cues.end = ((numberOfEightBars * eightBarsInSeconds) + offSet);
}

Track.prototype.extractChunk = function(buffer, size, startPos) {
// Cuts buffer into a large chunk - used on a large scale
    // Eg cut buffer in half: size = 0.5 startPos could be range  0-0.5
    const bufferLength = buffer.length;

    const chunk = Math.floor(bufferLength*size);
    startPos = Math.ceil(bufferLength*startPos);
    const finishPos = startPos+chunk;
    
    if (finishPos > bufferLength || startPos < 0) 
        return console.log("Buffer extract is out of Bounds!");
    else
        return buffer.slice(startPos,finishPos);
}

// ------------------------- END ------------------------- // 