'use strict';

// const getLinearInterpolation = function(current, target, frac) {
//     return current * ((100 - frac) / 100) + ((target * frac) / 100);
// }

// function init() 
// {
//     const results  = [];
//     const frac = [25,50,75,100];

//     frac.forEach(frac => {
//         results.push(getLinearInterpolation(10,20,frac));
//     });
//     console.log(results);
// }

function init()
{
    const lut_values = [187,169,156,157,173,204,244,287,321,342,345,332,307,279,254,238,232,235,245,258,269,278,282,281,274,260,240,213,181,147,116,94,84,86,101,122,145,163,173,173,168,161,158,161,173,190,208,220,223,214,195,171,149,133,131,141,163,190,216,235,242,237,222,203,184,173,171,179,192,204,209,203,186,160,133,113,108,122,152,193,235,267,281,273,247,211,174,149,141,151,176,205,227,234,222,192,152,111,82,70,79,105,142,179,209,226,227,216,197,177,161,153,153,159,169,181,192,202,210,219,226,232,234,232,221,203,179,151,124,103,92,93,106,128,154,179,197,204,199,182,157,126,97,72,57,54,63,83,112,145,177,201,216,217,206,187,165,148,141,148,167,195,223,241,244,227,193,149,105,72,58,65,91,128,165,193,206,202,186,165,149,143,151,169,192,213,225,225,215,199,183,175,176,188,208,229,246,254,250,236,217,198,183,177,179,186,194,199,196,184,165,144,126,116,118,132,155,180,203,217,220,212,197,180,165,157,156,159,163,163,155,140,120,98,82,76,81,97,121,147,170,187,196,198,195,191,186,183,181,179,178,178,180,186,197,210,223,232,232,221,198,167,135,108,96,101,124,160,200,233,250,248,227,194,159,134,126,140,173,215,256,284,292,277,245,203,164,136,126,131,147,165,176,172,154,124,89,59,43,45];

    const incrementor_output = [];

    console.log(`lut length: ${lut_values.length}`);

    let lut_index = 0,
        lut_incrementor = 0,
        lut_value = 0;

    do {
        if (lut_incrementor != lut_value) {
            if (lut_value - lut_incrementor > 0)
                lut_incrementor++;
            if (lut_value - lut_incrementor < 0) 
                lut_incrementor--;
            incrementor_output.push(lut_incrementor);
        }
        else if (lut_incrementor === lut_value) {
            lut_value = lut_values[++lut_index];
        }
        
    } while (lut_index < 300); // loop through whole of LUT
    console.log(`incrementor_output: ${incrementor_output}`);
}

window.onload = init();