import assert from 'node:assert/strict'
import test from 'node:test'
import { gameCatalog, getGameDefinition, getGameHref } from './games'

test('catalog includes dedicated multiplayer VS games with room links', () => {
  const expected = ['connect-four', 'reversi', 'rock-paper-scissors']

  for (const id of expected) {
    const game = getGameDefinition(id)
    assert.ok(game, `${id} should exist in the game catalog`)
    assert.equal(game.isMultiplayer, true)
    assert.ok(game.maxPlayers >= 2)
    assert.match(game.practiceLabel, /VS|Duel|Play/)
    assert.equal(getGameHref(id, { mode: 'room', gameId: 'room-123' }), `/games/${id}?mode=room&gameId=room-123`)
  }

  const socialVsGames = gameCatalog.filter((game) => game.isMultiplayer)
  assert.ok(socialVsGames.length >= 8)
})

test('catalog teaches every game and gives multiplayer games a VS AI route', () => {
  for (const game of gameCatalog) {
    assert.ok(game.tutorialSteps.length >= 3, `${game.id} should have tutorial steps`)
    if (game.isMultiplayer) {
      assert.match(game.aiLabel, /AI/, `${game.id} should expose an AI action label`)
      assert.equal(getGameHref(game.id, { mode: 'ai' }), `/games/${game.id}?mode=ai`)
    } else {
      assert.equal(game.aiLabel, game.practiceLabel)
    }
  }
})

test('catalog uses visual game marks instead of text placeholders for VS cards', () => {
  for (const id of ['connect-four', 'reversi', 'rock-paper-scissors']) {
    const game = getGameDefinition(id)
    assert.ok(game, `${id} should exist`)
    assert.notEqual(game.logo.kind, 'text', `${id} should not use a plain text logo`)
  }
})

test('catalog adds more VS board games including Go and Xiangqi', () => {
  const expected = ['go', 'xiangqi', 'gomoku', 'battleship', 'dots-and-boxes']

  for (const id of expected) {
    const game = getGameDefinition(id)
    assert.ok(game, `${id} should exist in the game catalog`)
    assert.equal(game.category, 'vs')
    assert.equal(game.isMultiplayer, true)
    assert.ok(game.maxPlayers >= 2)
    assert.match(game.practiceLabel, /AI|VS/)
  }

  assert.ok(gameCatalog.filter((game) => game.category === 'vs').length >= 8)
})
