const SIZE = 8;
const IMAGE_SIZES = [SIZE, 15, 29, 57, 113, 225];
const MIN_PIXELS  = [0, 4,  8,  16, 32,  64];
const PIXEL_TEMP_CONVERSION = 0.25;

/*var numberOfInterpolations = 4;
var min = 65555.0;
var max = 0;
var ave = 0;
var interpolatedBitmap;
var theBitmap;
var frameRate = 500;*/

var temp = [0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0];

function parseHexString(str) {
	var result = [];
	while (str.length >= 2) { 
		result.push(parseInt(str.substring(0, 2), 16));
		str = str.substring(2, str.length);
	}

	return result;
}

function signed_12bit_to_float(val) {
	// take first 11 bits as absolute val
	abs_val = (val & 0x7FF);
	if (val & 0x800)
		return 0.0 - abs_val;
	return abs_val;
}

function twos_comp_to_float(val) {
	val &= 0xfff;
	if (val & 0x800)
		val -= 0x1000;
	return val;
}

function matrix(rows, cols, defaultValue) {
	var arr = [];
	// Creates all lines:
	for (var i=0; i < rows; i++){
		// Creates an empty line
		arr.push([]);
		// Adds cols to the empty line:
		arr[i].push( new Array(cols));

		for (var j=0; j < cols; j++){
			// Initializes:
			arr[i][j] = defaultValue;
		}
	}
	return arr;
}

function fillBitmap(temp) {
	theBitmap = matrix(8, 8, 0.0);
	for (var i=0; i<8; i++) {
		for (var j=0; j < 8; j++) {
			theBitmap[i][j] = temp[i * 8 + j];
		}
	}
}

function computeAverage(theBitmap) {
	var ave = 0;
	var min = 65555.0;
	var max = 0;
	for (var i = 0; i < SIZE; i++) {
		for (var j = 0; j < SIZE; j++) {
			ave += theBitmap[i][j];
			if (theBitmap[i][j] < min) {
				min = theBitmap[i][j];
			}
			if (theBitmap[i][j] > max) {
				max = theBitmap[i][j];
			}
		}
	}
	
	ave /= (SIZE * SIZE);
	return {min:min, ave:ave, max:max}
}

function linearInterpolation(factor, interpolatedBitmap) {
	var size = IMAGE_SIZES[factor - 1];
	var interpolatedSize = IMAGE_SIZES[factor];
	//console.log("Size=" + interpolatedSize + ", " + interpolatedBitmap);
	
	copy = matrix(interpolatedSize, interpolatedSize, 0.0);
	for (var x = 0; x < size; x++) {
		for (var y = 0; y < size; y++) {
			copy[x*2][y*2] = interpolatedBitmap[x][y];
		}
	}
	
	for (var x= 0; x < interpolatedSize; x++) {
		for (var y = 0; y < interpolatedSize; y++) {
			interpolatedBitmap[x][y] = copy[x][y];
		}
	}
	copy = null;
	
	for (var x = 0; x < size; x++) {
		for (var y = 0; y < size; y++) {
			if (y < size - 1) {
				interpolatedBitmap[x*2][y*2 + 1] = (interpolatedBitmap[x * 2][y * 2] + interpolatedBitmap[x*2][(y+1)*2]) / 2;
			}
		}
	}

	for (var y = 0; y < interpolatedSize; y++) {
		for (var x = 0; x < size - 1; x++) {
			interpolatedBitmap[x*2 +1][y] = (interpolatedBitmap[x * 2][y] + interpolatedBitmap[(x + 1) *2][y]) / 2;
		}
	}
}

function linearInterpolate(numberOfInterpolations, rawBitmap, interpolatedBitmap) {
	//console.log("Number=" + numberOfInterpolations);
	//console.log("Raw          bitmap=" + rawBitmap);
	//console.log("SIZE = " + SIZE);

	for (var x = 0; x <SIZE; x++) {
		for (var y = 0; y < SIZE; y++) {
			interpolatedBitmap[x][y] = rawBitmap[x][y];
			//console.log("Raw          bitmap["+x+"]["+y+"]=" + rawBitmap[x][y]);
			//console.log("Interpolated bitmap["+x+"]["+y+"]=" + interpolatedBitmap[x][y]);
		}
	}
	//console.log("Interpolated bitmap first[0]=" + interpolatedBitmap);
	
	for (var inter = 1; inter <= numberOfInterpolations; inter++) {
		//console.log("Interpolated bitmap[" + inter + "]=" + interpolatedBitmap);
		linearInterpolation(inter, interpolatedBitmap);
	}
}

function fillRawBitmap(numberOfInterpolations, rawData, rawBitmap, interpolatedBitmap) {
	for (var i=0; i<8; i++) {
		for (var j=0; j < 8; j++) {
			var col = i * SIZE + j;
			var index = col << 1;
			raw = (rawData[index + 1] << 8) | (rawData[index]);
			rawBitmap[i][j] = twos_comp_to_float(raw) * PIXEL_TEMP_CONVERSION;
		}
	}
	linearInterpolate(numberOfInterpolations, rawBitmap, interpolatedBitmap);
	//console.log("Interpolated bitmap=" + interpolatedBitmap);
}
