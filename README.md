# AI 교실 (원종민)

테마별 강의자료 허브. 정적 사이트(GitHub Pages)이며 빌드 과정이 없습니다.

## 구조

| 파일 | 역할 |
|---|---|
| `index.html` | 자료실 (테마 카드 + 자료 목록) |
| `tools.html` / `tools.json` | 도구함. **도구는 여기에 한 번만 정의** |
| `prompts.html` / `prompts.json` | 프롬프트 보관함 |
| `materials.json` | 테마 목록과 자료 목록. 자료가 쓰는 도구를 연결 |
| `materials/<id>/` | 강의안 한 개 (슬라이드 `index.html`, 표지 `cover.jpg`, PDF) |

## 강의안과 도구·프롬프트의 연결

- 도구는 `tools.json`에 한 번만 정의하고, 강의안이 `materials.json`의 `tools: [{"id": "gemini", "slide": 6}]`로 가리킵니다.
  도구함 카드에 "나온 강의안 · n쪽" 링크가 자동으로 생깁니다.
- 프롬프트는 `prompts.json`의 `source`(강의안 id)와 `slide`(쪽)로 연결합니다.
- 자료실 카드의 `도구 n개 / 프롬프트 n개` 링크는 `?m=<id>`로 해당 강의안만 걸러서 보여 줍니다.

## 새 강의안 추가

1. `materials/<id>/`에 슬라이드와 `cover.jpg`, PDF를 넣는다.
2. `materials.json`의 `materials`에 항목을 추가한다 (`theme`은 `themes`의 id).
3. 새 도구는 `tools.json`에 추가하고, 강의안의 `tools`에 연결한다.
4. 프롬프트는 `prompts.json`에 `source`와 함께 추가한다.
5. 슬라이드의 각 쪽은 `id="p<번호>"`를 가지며 `#p15`처럼 바로 열 수 있다.
