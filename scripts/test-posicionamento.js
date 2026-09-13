'use strict';
const assert = require('node:assert/strict');
const { chavePosicionamento, chaveDoMacro } = require('../lib/posicionamento');

// Lado do lead: macro {{placement}} e coluna platform do export do Meta.
assert.equal(chaveDoMacro('Instagram_Stories'), 'instagram:stories');
assert.equal(chaveDoMacro('Instagram_Feed'), 'instagram:feed');
assert.equal(chaveDoMacro('Facebook_Mobile_Feed'), 'facebook:feed');
assert.equal(chaveDoMacro('Facebook_Desktop_Feed'), 'facebook:feed');
assert.equal(chaveDoMacro('ig'), 'instagram:geral');
assert.equal(chaveDoMacro('fb'), 'facebook:geral');
assert.equal(chaveDoMacro(''), null);
// Lado do gasto: breakdown publisher_platform + platform_position.
assert.equal(chavePosicionamento('instagram', 'instagram_stories'), 'instagram:stories');
assert.equal(chavePosicionamento('instagram', 'feed'), 'instagram:feed');
assert.equal(chavePosicionamento('facebook', 'facebook_stories'), 'facebook:stories');
assert.equal(chavePosicionamento('facebook', 'feed'), 'facebook:feed');
assert.equal(chavePosicionamento('audience_network', 'an_classic'), 'audience_network:classic');
assert.equal(chavePosicionamento('', ''), 'desconhecido:geral');
console.log('✓ posicionamento');
