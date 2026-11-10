// 개발자 화면 비밀번호 해시 만들기. 실행: node tools/dev-password.js 새비밀번호
// 출력된 값을 js/dev.js 의 DEV_HASH 에 붙여넣으면 된다.
const pw = process.argv[2];
if (!pw) { console.log('사용법: node tools/dev-password.js 새비밀번호'); process.exit(1); }
console.log(require('crypto').createHash('sha256').update(pw, 'utf8').digest('hex'));
