"""Tests execute the actual modified bot reward and transaction functions only."""
import ast, sqlite3, tempfile, time, re, hashlib, hmac, unittest
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor

SOURCE=Path(__file__).resolve().parents[1]/'bot'/'app.py'
functions={'get_db_connection','db_transaction','credit_coins','sign_minigame_message','minigame_claim','get_kst_now'}
module=ast.parse(SOURCE.read_text())
selected=ast.Module(body=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in functions],type_ignores=[])
ns={'sqlite3':sqlite3,'time':time,'re':re,'hashlib':hashlib,'hmac':hmac,'contextmanager':contextmanager,'datetime':datetime,'KST':timezone(timedelta(hours=9)),'MINIGAME_LINK_SECONDS':7200,'GAME_SECRET_KEY':'test-only-secret-for-pony-game-0123456789','MINIGAME_ACCESS':'public','MAX_AMOUNT':10**12,'ensure_coin_hall_month':lambda conn:None}
exec(compile(selected,str(SOURCE),'exec'),ns)

class Rewards(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(); ns['DB_PATH']=Path(self.temp.name)/'test.db'
  with sqlite3.connect(ns['DB_PATH']) as c:
   c.executescript('CREATE TABLE user_stats(user_id INTEGER PRIMARY KEY,coins INTEGER DEFAULT 0,max_coins INTEGER DEFAULT 0); CREATE TABLE minigame_rewards(user_id INTEGER NOT NULL,reward_day TEXT NOT NULL,coins INTEGER NOT NULL,code_hash TEXT UNIQUE NOT NULL,claimed_at TEXT NOT NULL,PRIMARY KEY(user_id,reward_day));')
  self.uid=123456789012345678
 def tearDown(self):self.temp.cleanup()
 def code(self,amount=10,uid=None,day=None,issued=None,prefix='OOPS3'):
  uid=uid or self.uid;day=day or ns['get_kst_now']().strftime('%Y%m%d');issued=issued or int(time.time());sig=ns['sign_minigame_message'](f'reward:pony3:{uid}:{amount}:{day}:{issued}');return f'{prefix}-{uid}-{amount}-{day}-{issued}-{sig}'
 def claim(self,code):return ns['minigame_claim'](self.uid,code)
 def test_admin_mode_never_pays(self):
  ns['MINIGAME_ACCESS']='admin'
  try:self.assertIsNotNone(self.claim(self.code())[1])
  finally:ns['MINIGAME_ACCESS']='public'
 def test_ten_coins_credit_once(self):
  self.assertEqual(self.claim(self.code()),(10,None));self.assertIsNotNone(self.claim(self.code(1))[1])
  with sqlite3.connect(ns['DB_PATH']) as c:self.assertEqual(c.execute('SELECT coins FROM user_stats').fetchone()[0],10)
 def test_parallel_claims_pay_once(self):
  with ThreadPoolExecutor(2) as pool:rows=list(pool.map(self.claim,[self.code(10),self.code(9)]))
  self.assertEqual(sum(error is None for coins,error in rows),1)
  with sqlite3.connect(ns['DB_PATH']) as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM minigame_rewards').fetchone()[0],1)
 def test_old_game_codes_and_out_of_range_amounts_rejected(self):
  for code in [self.code(prefix='OOPS2'),self.code(11),self.code(0)]:self.assertIsNotNone(self.claim(code)[1])
 def test_other_person_date_expiration_and_signature_rejected(self):
  for code in [self.code(uid=self.uid+1),self.code(day='20200101'),self.code(issued=int(time.time())-7201),self.code(issued=int(time.time())+10),self.code().replace('-10-','-9-')]:self.assertIsNotNone(self.claim(code)[1])
 def test_existing_daily_reward_is_preserved(self):
  with sqlite3.connect(ns['DB_PATH']) as c:c.execute('INSERT INTO minigame_rewards VALUES (?,?,?,?,?)',(self.uid,ns['get_kst_now']().strftime('%Y%m%d'),5,'old-game-code','existing'))
  self.assertIsNotNone(self.claim(self.code())[1])
 def test_yesterday_does_not_block_today(self):
  yesterday=(ns['get_kst_now']()-timedelta(days=1)).strftime('%Y%m%d')
  with sqlite3.connect(ns['DB_PATH']) as c:c.execute('INSERT INTO minigame_rewards VALUES (?,?,?,?,?)',(self.uid,yesterday,5,'old-game-code','existing'))
  self.assertEqual(self.claim(self.code(1)),(1,None))

if __name__=='__main__':unittest.main()
