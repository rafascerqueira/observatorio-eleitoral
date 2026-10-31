// Dados exclusivamente sintéticos para verificar invariantes; não são publicados.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinate, gpkgWkb } from '../src/sectors';

test('geometria do GeoPackage: cabeçalho GP e envelope removidos, WKB preservado; vazia não vira polígono', () => {
  const wkb = Buffer.from('0103000000', 'hex');
  const withEnvelope = Buffer.concat([Buffer.from([0x47, 0x50, 0x00, 0b00000011]), Buffer.alloc(4), Buffer.alloc(32), wkb]); // envelope xy (32 bytes)
  assert.deepEqual(gpkgWkb(withEnvelope), wkb);
  const noEnvelope = Buffer.concat([Buffer.from([0x47, 0x50, 0x00, 0b00000001]), Buffer.alloc(4), wkb]);
  assert.deepEqual(gpkgWkb(noEnvelope), wkb);
  assert.equal(gpkgWkb(Buffer.concat([Buffer.from([0x47, 0x50, 0x00, 0b00010001]), Buffer.alloc(4)])), null);
  assert.throws(() => gpkgWkb(Buffer.from('0000', 'hex')), /cabeçalho GP/);
  assert.throws(() => gpkgWkb(Buffer.from([0x47, 0x50, 0x00, 0b00001011, 0, 0, 0, 0])), /Envelope/);
});

test('coordenadas do TSE: só pontos no território brasileiro; sentinelas, zeros e texto ficam sem ponto', () => {
  assert.deepEqual(coordinate('-9.827566', '-66.8806837'), [-9.827566, -66.8806837]);
  assert.deepEqual(coordinate('-3.8549', '-32.4237'), [-3.8549, -32.4237], 'Fernando de Noronha');
  assert.deepEqual(coordinate('.85262333', '-51.183735'), [0.85262333, -51.183735], 'Sem zero inicial (Amapá)');
  assert.deepEqual(coordinate('-10,5721373', '-67,6756238'), [-10.5721373, -67.6756238], 'Vírgula decimal (cadastro de 2026)');
  assert.deepEqual(coordinate(',85', '-51,18'), [0.85, -51.18], 'Vírgula sem zero inicial');
  assert.equal(coordinate('-10.5,1', '-67.6'), null, 'Ponto e vírgula juntos não são decimal válido');
  assert.deepEqual(coordinate('-.5058683', '-50.7487266'), [-0.5058683, -50.7487266]);
  for (const [lat, lon] of [['-1', '-1'], ['0', '0'], ['', '-46.6'], ['-23.5', 'abc'], ['38.7', '-9.1'], ['.', '-50.1'], [',', '-50.1'], ['-.', '-50.1'], [undefined, undefined]]) assert.equal(coordinate(lat, lon), null, `${lat}, ${lon}`);
});
