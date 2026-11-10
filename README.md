# 포켓 아케이드 (Pocket Arcade)

모바일 우선으로 만든 오프라인 미니게임 모음입니다. 외부 라이브러리 없이 순수 HTML/CSS/JS로 만들었습니다.

- **오프라인 플레이**: 한 번 접속한 뒤 "홈 화면에 추가"하면 인터넷 없이 실행됩니다 (PWA / Service Worker).
- **저장**: 기기 브라우저의 localStorage에 저장합니다. 서버나 DB가 필요 없습니다. 설정 화면의 "저장 백업/불러오기"로 다른 기기에 옮길 수 있습니다.
- **조작**: 모바일은 가상 방향키 또는 화면 드래그, PC는 방향키/WASD.

## 미니게임
| 게임 | 파일 |
|---|---|
| 던전 탈출 | `js/games/dungeon.js` |

## 새 미니게임 추가하기
1. `js/games/새게임.js` 파일을 만들고 `Arcade.register({ id, title, desc, drawIcon, create })`로 등록
2. `index.html`에 `<script>` 추가
3. `sw.js`의 `ASSETS` 목록에 파일 경로 추가

## 아이콘 다시 만들기
```
node tools/make-icons.js
```
