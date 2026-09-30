#!/usr/bin/env python3
"""Apply the Pony minigame replacement to your private bot app.py. No credentials included.
Usage: python bot/apply_pony_patch.py /path/to/app.py
The supplied original version is the supported input. Make a backup first.
"""
import ast,json,sys
from pathlib import Path
PARTS=json.loads('{"load_minigame_access": "def load_minigame_access() -> str:\\n    value = os.environ.get(\'MINIGAME_ACCESS\', \'\')\\n    if not value:\\n        env_file = Path(__file__).resolve().with_name(\'.env\')\\n        if env_file.is_file():\\n            for line in env_file.read_text(encoding=\'utf-8-sig\').splitlines():\\n                name, separator, raw_value = line.partition(\'=\')\\n                if separator and name.strip() == \'MINIGAME_ACCESS\':\\n                    value = raw_value.strip().strip(\'\\"\\\\\'\')\\n                    break\\n    return \'public\' if value == \'public\' else \'admin\'", "minigame_claim": "def minigame_claim(user_id: int, code: str):\\n    \\"\\"\\"포니 탈출 작전 전용 서명·날짜 확인. 기존 일일 지급 기록은 이어받습니다.\\"\\"\\"\\n    if MINIGAME_ACCESS != \'public\':\\n        return None, \'관리자 테스트 중에는 실제 코인을 지급하지 않습니다.\'\\n    match = re.fullmatch(r\'OOPS3-(\\\\d{17,20})-(10|[1-9])-(\\\\d{8})-(\\\\d{10})-([A-Fa-f0-9]{64})\', code.strip())\\n    if not match:\\n        return None, \'보상 코드 형식이 올바르지 않습니다.\'\\n    issued_user, amount, day, issued, signature = match.groups()\\n    if int(issued_user) != user_id:\\n        return None, \'본인에게 발급된 보상 코드만 사용할 수 있습니다.\'\\n    if day != get_kst_now().strftime(\'%Y%m%d\'):\\n        return None, \'보상 코드는 발급된 날(한국 시간 자정 전)에만 사용할 수 있습니다.\'\\n    now = int(time.time())\\n    if not 0 <= now - int(issued) <= MINIGAME_LINK_SECONDS:\\n        return None, \'보상 코드 유효 기간(2시간)이 지났습니다.\'\\n    payload = f\'reward:pony3:{issued_user}:{amount}:{day}:{issued}\'\\n    if not hmac.compare_digest(sign_minigame_message(payload), signature.upper()):\\n        return None, \'보상 코드의 서명이 유효하지 않습니다.\'\\n    with db_transaction() as conn:\\n        if conn.execute(\'SELECT 1 FROM minigame_rewards WHERE user_id=? AND reward_day=?\', (user_id, day)).fetchone():\\n            return None, \'오늘은 이미 미니게임 보상을 받았습니다. 내일 다시 참여해 주세요.\'\\n        try:\\n            conn.execute(\'INSERT INTO minigame_rewards (user_id,reward_day,coins,code_hash,claimed_at) VALUES (?,?,?,?,?)\',\\n                         (user_id, day, int(amount), hashlib.sha256(code.upper().encode(\'ascii\')).hexdigest(), get_kst_now().isoformat()))\\n            credit_coins(conn, user_id, int(amount))\\n        except sqlite3.IntegrityError:\\n            return None, \'이미 사용된 보상 코드입니다.\'\\n    return int(amount), None", "minigame_test_admin": "def minigame_test_admin(member) -> bool:\\n    # 테스트 링크는 서버 소유자, 마스터, 운영진만 발급합니다. PUBG 역할은 제외합니다.\\n    return getattr(member, \'guild\', None) is not None and (\\n        member.id == member.guild.owner_id or\\n        any(role.id in (ROLE_IDS[\'마스터\'], ROLE_IDS[\'운영진\']) for role in member.roles)\\n    )", "cmd_minigame": "@bot.command(name=\'미니게임\')\\nasync def cmd_minigame(ctx):\\n    if MINIGAME_ACCESS != \'public\' and not minigame_test_admin(ctx.author):\\n        await ctx.send(\'새 미니게임 관리자 테스트 중입니다. 정식 오픈 후 이용해 주세요.\', delete_after=15)\\n        return\\n    if not minigame_channel_allowed(ctx):\\n        await ctx.send(f\'미니게임은 <#{CONGRAT_CHANNEL_ID}>에서 이용할 수 있습니다. 관리자 채널은 운영진만 사용할 수 있습니다.\', delete_after=10)\\n        return\\n    if len(GAME_SECRET_KEY) < 32:\\n        await ctx.send(\'미니게임 설정이 완료되지 않았습니다. 운영진에게 문의해 주세요.\', delete_after=10)\\n        return\\n    day = get_kst_now().strftime(\'%Y%m%d\')\\n    with db_transaction() as conn:\\n        claimed = conn.execute(\'SELECT 1 FROM minigame_rewards WHERE user_id=? AND reward_day=?\', (ctx.author.id, day)).fetchone()\\n    expires = int(time.time()) + MINIGAME_LINK_SECONDS\\n    test_mode = MINIGAME_ACCESS != \'public\'\\n    namespace = \'link:pony3:admin\' if test_mode else \'link:pony3\'\\n    sig = sign_minigame_message(f\'{namespace}:{ctx.author.id}:{expires}\')\\n    link_params = {\\"uid\\": ctx.author.id, \\"exp\\": expires, \\"sig\\": sig}\\n    if test_mode:\\n        link_params[\'access\'] = \'admin\'\\n    url = f\'{MINIGAME_URL}?{urlencode(link_params)}\'\\n    description = (\'🔒 관리자 테스트 전용 · 실제 코인 지급 없음\\\\n\' if test_mode else\\n                   (\'오늘 보상은 이미 받으셨습니다. 게임은 연습용으로 즐길 수 있습니다.\\\\n\' if claimed else \'\'))\\n    try:\\n        await ctx.author.send(f\'🚙 **OOPS 포니 탈출 작전**\\\\n{description}{url}\\\\n포니 쿠페로 2분 동안 보급을 파밍하고 탈출하세요!\\\\nPC 좌클릭 / 모바일 터치로 운전 · 보급상자 옆에서 정차하면 자동 파밍\\\\n주행 1m = 1점 · 보급상자 750점 · 탈출 보너스 1,500점\\\\n1,000점당 1코인 (하루 1회, 최대 10코인). 게임은 무제한 이용 가능합니다.\\\\n종료 화면의 `!보상 [코드]`를 복사해 저스트채팅에 입력하세요.\\\\n개인 링크 유효 기간: 2시간.\')\\n    except discord.Forbidden:\\n        await ctx.send(f\'{ctx.author.mention} DM을 보낼 수 없습니다. 서버 개인 메시지 허용 설정을 확인해 주세요.\', delete_after=15)\\n        return\\n    await ctx.send(f\'{ctx.author.mention} 개인 DM으로 미니게임 링크를 보냈습니다!\', delete_after=15)"}')
def main():
 path=Path(sys.argv[1])
 source=path.read_text(encoding='utf-8')
 tree=ast.parse(source)
 spans=[]
 for n in tree.body:
  if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in ('minigame_claim','cmd_minigame'):
   first=min([n.lineno]+[d.lineno for d in n.decorator_list])-1
   replacement=PARTS[n.name]
   if n.name=='cmd_minigame' and 'def minigame_test_admin(' not in source:replacement=PARTS['minigame_test_admin']+'\n\n'+replacement
   spans.append((first,n.end_lineno,replacement))
 if len(spans)!=2:raise SystemExit('Expected minigame functions were not found; no file changed.')
 lines=source.splitlines()
 for first,last,replacement in sorted(spans,reverse=True):lines[first:last]=replacement.splitlines()
 source='\n'.join(lines)+'\n'
 if 'def load_minigame_access(' not in source:
  anchor='GAME_SECRET_KEY = load_game_secret_key()'
  if anchor not in source:raise SystemExit('Expected secret loader not found; no file changed.')
  source=source.replace(anchor,PARTS['load_minigame_access']+'\n\nMINIGAME_ACCESS = load_minigame_access()\n'+anchor)
 source=source.replace("MINIGAME_URL = 'https://oops-minigame.vercel.app/'", "MINIGAME_URL = os.environ.get('MINIGAME_URL', 'https://oops-minigame.vercel.app/').rstrip('/') + '/'")
 ast.parse(source)
 backup=path.with_suffix(path.suffix+'.before-pony')
 if not backup.exists():backup.write_text(path.read_text(encoding='utf-8'),encoding='utf-8')
 path.write_text(source,encoding='utf-8')
 print('Pony minigame applied. Default mode: admin test. Existing database retained.')
if __name__=='__main__':
 if len(sys.argv)!=2:raise SystemExit('Usage: python bot/apply_pony_patch.py /path/to/app.py')
 main()
