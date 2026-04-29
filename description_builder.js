function buildDescription(description) {
    var output = "";
    if (description.noDamage) {
       output += description.attackerName + " ";
       output += description.moveName + " ";
       output += description.defenderName;
       output += ": No damage";
       return output;
    };
    if (description.attackBoost) {
        if (description.attackBoost > 0) {
            output += "+";
        }
        output += description.attackBoost + " ";
    }
    output = appendIfSet(output, description.attackEVs);
    output = appendIfSet(output, description.attackerItem);
    output = appendIfSet(output, description.attackerAbility);
    if (description.isBurned) {
        output += "burned ";
    }
    output += description.attackerName + " ";
	if (description.isHelpingHand) {
		output += "Helping Hand ";
	}
    output += description.moveName + " ";
    if (description.moveBP && description.moveType) {
        output += "(" + description.moveBP + " BP " + description.moveType + ") ";
    } else if (description.moveBP) {
        output += "(" + description.moveBP + " BP) ";
    } else if (description.moveType) {
        output += "(" + description.moveType + ") ";
    }
    output += "vs. ";
	if (description.protect) {
        output += " protected ";
    }	
    if (description.defenseBoost) {
        if (description.defenseBoost > 0) {
            output += "+";
        }
        output += description.defenseBoost + " ";
    }
    output = appendIfSet(output, description.HPEVs);
    if (description.defenseEVs) {
        output += "/ " + description.defenseEVs + " ";
    }
    output = appendIfSet(output, description.defenderItem);
    output = appendIfSet(output, description.defenderAbility);
    output += description.defenderName;
    if (description.weather) {
        output += " in " + description.weather;
    }
	if (description.terrain) {
        output += " in " + description.terrain;
    }
    if (description.isReflect) {
        output += " through Reflect";
    } else if (description.isLightScreen) {
        output += " through Light Screen";
    } 
	if (description.isAuroraVeil) {
        output += " with an ally's Aurora Veil";
    }
	if (description.isCrit) {
        output += " on a Critical Hit";
    }
    output += ': ';
    output += description.minDamage + '-' + description.maxDamage;
    output += ' ';
    output += '(' + description.minPercent + ' - ' + description.maxPercent + '%)';
    return output;
}

function appendIfSet(str, toAppend) {
    if (toAppend) {
        return str + toAppend + " ";
    }
    return str;
}
