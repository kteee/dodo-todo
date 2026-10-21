/**
 * 사이트 푸터 — 보드(일간·주간·월간)엔 없음. 로그인 전 화면·마이페이지·개인정보 처리방침에만.
 * 왼쪽: 두두 서비스 링크, 오른쪽: 처리방침·문의. 폰에선 두 줄 가운데 정렬
 */
const CONTACT = "kte02320@gmail.com";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="sf-family" aria-label="두두 서비스">
        <span className="sf-copy">© 두두다이어리</span>
        <a href="https://dododiary.com">두두 홈</a>
        <span className="sf-dot" aria-hidden="true">·</span>
        <a href="/" aria-current="page" className="sf-now">
          투두리스트
        </a>
        <span className="sf-dot" aria-hidden="true">·</span>
        <span className="sf-soon">북로그 (준비 중)</span>
      </nav>
      <nav className="sf-info" aria-label="안내">
        <a href="/privacy">개인정보 처리방침</a>
        <span className="sf-dot" aria-hidden="true">·</span>
        <a href={"mailto:" + CONTACT}>문의</a>
      </nav>
    </footer>
  );
}
