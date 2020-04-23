function scanI2c( i2c, first, last ) {
   if (typeof first === "undefined") {
		first = 0x03;
	}
	if (typeof (last) === "undefined") {
		last = 0x77;
	}
	print( "     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f" );
	for (var upper = 0; upper < 10; ++upper) {
		var line = upper + "0: ";
		for (var lower = 0; lower < 16; ++lower) {
			var address = (upper << 4) + lower;
			// Skip unwanted addresses
			if ((address < first) || (address > last)) {
				line += "   ";
				continue;
			}
			try {
				i2c.readFrom( {address:address, stop:false}, 1 );
				line += (address + 0x100).toString( 16 ).substr( -2 );
				line += " ";
			} catch (err) {
				line += "-- ";
			}
		}
		print( line );
	}
}

function toHexString(data) {
	return data.reduce(function(r,b){ return r+("0"+b.toString(16)).substr(-2); },"");
}

_NORMAL_MODE = 0x00;
_SLEEP_MODE  = 0x10;
_STAND_BY_60 = 0x20;
_STAND_BY_10 = 0x21;

// sw resets
_FLAG_RESET    = 0x30;
_INITIAL_RESET = 0x3F;

// frame rates
_FPS_10 = 0x00;
_FPS_1  = 0x01;

// int enables
_INT_DISABLED = 0x00;
_INT_ENABLED  = 0x01;

// int modes
_DIFFERENCE     = 0x00;
_ABSOLUTE_VALUE = 0x01;

_INT_OFFSET   = 0x010;
_PIXEL_OFFSET = 0x80;

_PIXEL_ARRAY_WIDTH = 8;
_PIXEL_ARRAY_HEIGHT = 8;
_PIXEL_TEMP_CONVERSION = 0.25;
_THERMISTOR_CONVERSION = 0.0625;

_pctl=[0x00, 0];
_rst=[0x01, 0];
_fps=[0x02, 0];
_inten=[0x03, 0];
_intmod=[0x03, 1];

_intf=[0x04, 1];
_ovf_irs=[0x04, 2];
_ovf_ths=[0x04, 3];

_intclr=[0x05, 1];
_ovs_clr=[0x05, 2];
_ovt_clr=[0x05, 3];

_mamod=[0x07, 5];

_inthl=[0x08, 0];
_inthh=[0x09, 0]; // 4 bits
_intll=[0x0A, 0];
_intlh=[0x0B, 0];
_ihysl=[0x0C, 0];
_ihysh=[0x0D, 0];

_tthl=[0x0E, 0];

_tthh=[0x0F, 0];

class AMG8833 {
	
    //"""Driver for the AMG88xx GRID-Eye IR 8x8 thermal camera."""
	constructor() {
	}

    // Set up the registers
    connect(i2c, addr) {
	    this.i2c_device = i2c;
		this.addr = addr;

        // Enter normal mode
        this.write(_pctl[0], _NORMAL_MODE);

        // software reset
        this.write(_rst[0], _INITIAL_RESET);

        // disable interrupts by default
        this.write(_inten[0], 0);

        // set to 10 FPS
        this.write(_fps[0], _FPS_10);
	}
	
	read(reg, len) {
		this.i2c_device.writeTo({address:this.addr, stop:false}, reg);
		return this.i2c_device.readFrom(this.addr, len);
	}
	
	write(reg, data) {
		this.i2c_device.writeTo({address:this.addr, stop:false}, [reg, data]);
	}

	_signed_12bit_to_float(val) {
		// take first 11 bits as absolute val
		abs_val = (val & 0x7FF);
		if (val & 0x800)
			return 0.0 - abs_val;
		return abs_val;
	}

	_twos_comp_to_float(val) {
		val &= 0xfff;
		if (val & 0x800)
			val -= 0x1000;
		return val;
	}

    temperature() {
        // Temperature of the sensor in Celsius
		tth = this.read(this._tthl[0], 2);
        raw = (tth[1] << 8) | tth[0];
        return this._signed_12bit_to_float(raw) * _THERMISTOR_CONVERSION;
	}

	matrix( rows, cols, defaultValue) {
		var arr = [];
		// Creates all lines:
		for (var i=0; i < rows; i++){
		  // Creates an empty line
		  arr.push([]);
		  // Adds cols to the empty line:
		  arr[i].push( new Array(cols));

		  for(var j=0; j < cols; j++){
			// Initializes:
			arr[i][j] = defaultValue;
		  }
		}
		return arr;
	}
	
    pixels() {
        /* Temperature of each pixel across the sensor in Celsius.
           Temperatures are stored in a two dimensional list where the first index is the row and
           the second is the column. The first row is on the side closest to the writing on the
           sensor. */

        retbuf = this.matrix(_PIXEL_ARRAY_HEIGHT, _PIXEL_ARRAY_WIDTH, 0);
        rawData = this.read(_PIXEL_OFFSET, 128);
		for (row=0; row < _PIXEL_ARRAY_HEIGHT; row++) {
			for (col=0; col < _PIXEL_ARRAY_WIDTH; col++) {
				i = row * _PIXEL_ARRAY_HEIGHT + col;
				index = i << 1;
				pixel = _PIXEL_OFFSET + (i << 1);				
				//buf = this.read(pixel, 2);
				raw = (rawData[index + 1] << 8) | (rawData[index]);
				//raw = (buf[1] << 8) | buf[0];
				retbuf[row][col] = this._twos_comp_to_float(raw) * _PIXEL_TEMP_CONVERSION;
			}
		}
        return retbuf;
	}
	
	pixelArray() {
		rawData = this.read(_PIXEL_OFFSET, 128);
		return rawData;
	}
	
	sleep() {
        // Enter sleep mode
        this.write(this._pctl[0], _SLEEP_MODE);
        // software reset
        this.write(this._rst[0], _INITIAL_RESET);
	}
}

class OOSB {
	setGreenLed(on) {
		this.greenLed = on;
		D16.write(this.greenLed);
		NRF.updateServices({
		  "1c0c2b9c-7013-11ea-bc55-0242ac130001" : {
			0xA001 : {
			  value : this.greenLed,
			  notify: true
			}
		  }
		});
	}

	setRedLed(on) {
		this.redLed = on;
		D15.write(this.redLed);
		NRF.updateServices({
		  "1c0c2b9c-7013-11ea-bc55-0242ac130001" : {
			0xA002 : {
			  value : this.redLed,
			  notify: true
			}
		  }
		});
	}
	
	setPresence(on) {
		this.presence = on;
		NRF.updateServices({
		  "1c0c2b9c-7013-11ea-bc55-0242ac130001" : {
			0xA003 : {
			  value : this.presence,
			  notify: true
			}
		  }
		});
	}

	initializeAmg8833() {
		if (!this.initialized) {
			this.amg8833 = new AMG8833();
			//i2c = new I2C();
			//i2c.setup( {sda:D21, scl:D22} );
			I2C1.setup( {sda:D24, scl:D25, bitrate:400000} );
			this.amg8833.connect(I2C1, 0x68);
			this.initialized = true;
		}
	}
	
	pixels() {
		this.initializeAmg8833();
		return this.amg8833.pixels();
	}

	pixelArray() {
		this.initializeAmg8833();
		return "TH=" + toHexString(this.amg8833.pixelArray());
	}

	temperature() {
		this.initializeAmg8833();
		return this.amg8833.temperature();
	}
	
	setServices() {
		NRF.setServices({
		  "1c0c2b9c-7013-11ea-bc55-0242ac130001" : {
			0xA001 : {
			  value : [this.greenLed],
			  maxLen : 1,
			  readable : true,
			  notify : true,
			},
			0xA002 : {
			  value : [this.redLed],
			  maxLen : 1,
			  readable : true,
			  notify : true,
			},
			0xA003 : {
			  value : this.presence,
			  maxLen : 1,
			  notify: true,
			  readable : true
			},
			0xA004 : {
			  value : NRF.getBattery().toString(),
			  maxLen : 6,
			  readable : true
			},
		  }
		});
	}

	constructor() {
		pinMode(D15, "output");
		pinMode(D16, "output");
		this.initialized = false;
		this.presence = 0;
		this.greenLed = 1;
		this.redLed = 0;
		digitalWrite(D15, this.redLed); // Red Led
		digitalWrite(D16, this.greenLed); // Green Led		
		pinMode(D2, "input");
		this.setServices();
	}
}

oosb = new OOSB();		
clearWatch();
setWatch(function(e) {
	oosb.setPresence(e.state);
	oosb.setRedLed(e.state);},
	D2,
	{repeat:true, edge:"both"}
);

