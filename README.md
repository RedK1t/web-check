<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/RedK1t/RedKit/main/docs/assets/logo-light.svg">
    <img src="https://raw.githubusercontent.com/RedK1t/RedKit/main/docs/assets/logo-dark.svg" alt="RedKit" width="96">
  </picture>
</p>

<h1 align="center">RedKit Web Check</h1>

<p align="center">Passive web analysis API: TLS, headers, DNS, cookies, tech stack, screenshots and more.<br>
Part of <a href="https://github.com/RedK1t/RedKit"><b>RedKit</b></a>, a modular, web-based penetration-testing framework.</p>

---

## Endpoints

Each check is its own route under `/api` (see [`api/`](api) and [API_DOCUMENTATION.md](API_DOCUMENTATION.md)), for example `ssl`, `http-security`, `dns-server`, `firewall`, `tech-stack`, `cookies`, `robots-txt`, `sitemap`, `linked-pages`, `archives` and `screenshot`.

## Run

```bash
cp template.env .env
npm install
npm run dev             # http://localhost:3001/api
```

With Docker (Chromium included for screenshots):

```bash
docker build -t redkit-web-check . && docker run -p 3001:3001 redkit-web-check
```

## License

[MIT](LICENSE). For authorized security testing and education only. Only scan systems you own or have written permission to test.
