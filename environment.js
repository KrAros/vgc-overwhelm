/**
  * Initialises the environment object.
  * @param environment a saved JSON environment object
  */
function Environment(numAttackers, numTargets, environment) {
   if (typeof(environment) === 'undefined') {
      this.numAttackers = numAttackers;
      this.numTargets = numTargets;
      this.pokemons = [];
      this.pokemons[0] = [];
      for (var i = 0; i < numAttackers; i++) {
         this.pokemons[0].push(new Pokemon(DEFAULT_NUM_MOVES));
      };
      this.pokemons[1] = [];
      for (var i = 0; i < numTargets; i++) {
         this.pokemons[1].push(new Pokemon(DEFAULT_NUM_MOVES));
      };
      this.weather = 0;
	  this.terrain = 0;
	  this.tier = 0;
      this.trickRoom = false;
      this.auroraVeilA = false;
	  this.auroraVeilB = false;
      this.critA = false;
	  this.critB = false;
      this.protectA = false;
	  this.protectB = false;
      this.zMoveA = false;
	  this.zMoveB = false;
      this.helpingHandA = false;
	  this.helpingHandB = false;
      this.lightScreen = [false, false];
      this.reflect = [false, false];
      this.multiHit = MULTI_HIT_FULL;
      this.doubles = false;
      this.defaultLevel = 50;
      this.displayOption = 'verbose';
      this.dualMode = false;
   } else {
      this.numAttackers = environment.numAttackers;
      this.numTargets = environment.numTargets;
      this.pokemons = environment.pokemons;
	  this.terrain = environment.terrain;
      this.weather = environment.weather;
      this.trickRoom = environment.trickRoom;
      this.auroraVeilA = environment.auroraVeilA;
      this.auroraVeilB = environment.auroraVeilB;
      this.critA = environment.critA;
      this.critB = environment.critB;
      this.protectA = environment.protectA;
      this.protectB = environment.protectB;
      this.zMoveA = environment.zMoveA;
      this.zMoveB = environment.zMoveB;
      this.helpingHandA = environment.helpingHandA;
      this.helpingHandB = environment.helpingHandB;
      this.lightScreen = environment.lightScreen;
      this.reflect = environment.reflect;
      this.multiHit = environment.multiHit;
      this.doubles = environment.doubles;
      this.defaultLevel = environment.defaultLevel;
      this.displayOption = environment.displayOption;
      this.dualMode = environment.dualMode;
      for (var i = 0; i < environment.pokemons.length; i++) {
         for (var j = 0; j < environment.pokemons[i].length; j++) {
            // retrieve the pokemon
            environment.pokemons[i][j] = new Pokemon(DEFAULT_NUM_MOVES, environment.pokemons[i][j]);
            // validate the pokemon
            environment.pokemons[i][j].validate();
         };
      };
   };
};

/**
  * Resets an entire Pokemon team to nothing.
  * @param teamNum the team number (0 = yours, 1 = target)
  */
Environment.prototype.resetTeam = function(teamNum) {
   this.pokemons[teamNum] = [];
   var numPokemon;
   if (teamNum == 0) {
      numPokemon = this.numAttackers;
   } else {
      numPokemon = this.numTargets;
   };
   for (var i = 0; i < numPokemon; i++) {
      var pokemon = new Pokemon(DEFAULT_NUM_MOVES);
      pokemon.changeLevel(this.defaultLevel);
      this.pokemons[teamNum].push(pokemon);
   };
};

/**
  * Switches the two teams around.
  */
Environment.prototype.switchTeams = function () {
   var tmp = this.pokemons[0];
   this.pokemons[0] = this.pokemons[1];
   this.pokemons[1] = tmp;
   var tmp2 = this.numAttackers;
   this.numAttackers = this.numTargets;
   this.numTargets = tmp2;
   var reflectTmp = this.reflect[0];
   this.reflect[0] = this.reflect[1];
   this.reflect[1] = reflectTmp;
   var lightScreenTmp = this.lightScreen[0];
   this.lightScreen[0] = this.lightScreen[1];
   this.lightScreen[1] = lightScreenTmp;
   var auroraVeilTmp = this.auroraVeilA;
   this.auroraVeilA = this.auroraVeilB;
   this.auroraVeilB = auroraVeilTmp;
   var protectTmp = this.protectA;
   this.protectA = this.protectB;
   this.protectB = protectTmp;
   var zMoveTmp = this.zMoveA;
   this.zMoveA = this.zMoveB;
   this.zMoveB = zMoveTmp;
   var helpingHandTmp = this.helpingHandA;
   this.helpingHandA = this.helpingHandB;
   this.helpingHandB = helpingHandTmp;
};
