# jbrowse-plugin-blat

Bundled in no JBrowse product. It loads from a config's `plugins` entry, which
jb2hubs writes into every genomes.jbrowse.org config, because a search only
works on a UCSC-hosted assembly and a hosted bundle takes a UCSC-side fix
without a JBrowse release. The plugin store hosts it as an `unlisted` entry:
resolvable by `storePlugin`, never offered for install.

Every query goes to the server in the dialog, the jbrowse.org proxy
(`products/aws/blat-proxy` in jbrowse-components) by default; there is no
direct-to-UCSC path, apiKey field or CAPTCHA window.

**A release is live on every hub config at once**, v4.3.0 included, since they
name the store's no-cache `latest/` bundle. `pnpm host-compat` boots the
candidate there; the bundle must load on v4.3.0 and install nothing.
`pnpm floor` builds against what the newest JBrowse release serves.

Facts not in the source:

- UCSC caps a key at **5000 hits/day**, on top of the 1-per-15s rate limit.
- BLAT extends a block through matching junk bases, so a junk-prefixed query's
  soft clip comes back a base or two shorter than the junk. The conversion is
  right.
- hgBlat answers no match with `"blat": []`, so a zero-hit result is an answer
  and the proxy's any-HTML-is-a-bad-key rule holds. hgPcr answers "No matches"
  as an HTML page.
