var sha256 = require('js-sha256');

const WHITELIST = ["BoschMods", "aurakiller65212", "ShinyL", "tommf", "rymflan"];
let WHITELIST_HASH = [];

let reforgeMap = new Map();
let reforges = ["NECROTIC", "ANCIENT", "FABLED", "GIANT", "GENTLE", "ODD", "FAST", "FAIR", "EPIC", "SHARP", "HEROIC", "SPICY", "LEGENDARY", "DIRTY", "GILDED", "WARPED", "BULKY", "SALTY", "TREACHEROUS", "STIFF", "LUCKY", "DEADLY", "FINE", "GRAND", "HASTY", "NEAT", "RAPID", "UNREAL", "AWKWARD", "RICH", "PRECISE", "HEADSTRONG", "CLEAN", "FIERCE", "HEAVY", "LIGHT", "MYTHIC", "PURE", "SMART", "TITANIC", "WISE", "PERFECT", "SPIKED", "RENOWNED", "CUBIC", "WARPED", "REINFORCED", "LOVING", "RIDICULOUS", "SUBMERGED", "JADED", "BIZARRE", "ITCHY", "OMINOUS", "PLEASANT", "PRETTY", "SHINY", "SIMPLE", "STRANGE", "VIVID", "GODLY", "DEMONIC", "FORCEFUL", "HURTFUL", "KEEN", "STRONG", "SUPERIOR", "UNPLEASANT", "ZEALOUS", "SILKY", "BLOODY", "SHADED", "SWEET", "FRUITFUL", "MAGNETIC", "REFINED", "BLESSED", "FLEET", "STELLAR", "MITHRAIC", "AUSPICIOUS", "HEATED", "AMBERED"];
for (let reforge in reforges) {
    reforgeMap.set(reforges[reforge], reforge);
}

let PRINT_STRING = "";

module.exports = {
    isWhitelisted: (name) => {
        //return WHITELIST_HASH.includes(name);
        return true;
    },

    getName: (input) => {
        let name = input.item_name;

        if (name.length == 0) {
            console.log(input);
        }

		if (name.includes("Enchanted Book")) {
			let firstComma = input.item_lore.indexOf(',') > 0 ? input.item_lore.indexOf(',') : Number.MAX_SAFE_INTEGER;
			let firstNewline = input.item_lore.indexOf('\n') > 0 ? input.item_lore.indexOf('\n') : Number.MAX_SAFE_INTEGER;

			let end = Math.min(firstComma, firstNewline);
            name = input.item_lore.substring(2, end);
            while (!module.exports.isLetter(name[0])) {
                name = name.substring(2, name.length);
            }
		}

		name = name.replace(/[^0-9a-z -']/gi, '').trim();
		
		let tag = name.toUpperCase();
		let tagSplit = tag.split(" ");

		if (reforgeMap.has(tagSplit[0].toUpperCase())) {
			tagSplit.shift();
		}

        return module.exports.niceCapitalize(tagSplit.join(" "));
	},

    sbNumberFormat(input) {
        if (!input) { return -1; }
        input = input.replaceAll(',', '');

        let parsed = parseFloat(input, 10);
        if (isNaN(parsed)) { return -1; }

        let isNormalNumber = ("" + parsed) == input;

        if (isNormalNumber) {
            return parsed;
        }

        let prefix = parseFloat(input.substring(0, input.length - 1), 10);
        let isNormalPrefix = ("" + prefix) == input.substring(0, input.length - 1);

        if (isNormalPrefix) {
            let finalChar = input[input.length - 1];
            if (finalChar == 'k') {
                return prefix * 1000;
            }
            if (finalChar == 'm') {
                return prefix * 1000000;
            }
            if (finalChar == 'b') {
                return prefix * 1000000000;
            }
        }
         
        return -1;
    },
    
    cleanRound(num, dec) {
        return Math.floor(num * Math.pow(10, dec)) / Math.pow(10, dec);
    },

    niceCapitalize(text) {
        let niceText = "";
        text.split(" ").forEach((a) => { if (typeof a == "string" && a.length > 0) { niceText += a[0].toUpperCase() + a.substring(1, a.length).toLowerCase() + " "; } });
        return niceText.substring(0, niceText.length - 1);
    },

    isLetter: (str) => {
        return str.length === 1 && str.match(/[a-z]/i);
    },

    getArgument(str, arg) {
        let index = str.indexOf(arg);
        let trimmedStr = str.substring(index + arg.length + 1);
        let indexNext = trimmedStr.indexOf("&");
        return trimmedStr.substring(0, indexNext < 0 ? trimmedStr.length : indexNext);
    },

    hash(str) {
        return sha256(str+"_verify");
    },

    log(str) {
        console.log(str);
        PRINT_STRING += str + "\n";
    },

    getLog() {
        return PRINT_STRING;
    }
}

for (let i in WHITELIST) {
    WHITELIST_HASH.push(module.exports.hash(WHITELIST[i]));
}