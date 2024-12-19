import { run, bench } from "mitata";
import { strformat } from ".";
import crypto from "node:crypto";
import dot from "dot";
import ejs from "ejs";
import { Eta } from "eta";

const eta = new Eta();

function createBench(fn: () => (ctx: Record<string, unknown>) => void) {
  const _fn = fn();

  return function* () {
    const ctx = {
      filename: "MyNamespace~my-app-script",
      hash: crypto.randomBytes(16).toString("hex"),
      ext: "js",
    };

    yield () => {
      _fn(ctx);
    };
  };
}

bench(
  "strformat",
  createBench(() => {
    return (ctx) => {
      strformat("[filename].[hash].[ext]", ctx);
    };
  }),
);

bench(
  "dot",
  createBench(() => {
    return (ctx) => {
      dot.template("{{=it.filename}}.{{=it.hash}}.{{=it.ext}}")(ctx);
    };
  }),
);

bench(
  "dot (precompile)",
  createBench(() => {
    const render = dot.template("{{=it.filename}}.{{=it.hash}}.{{=it.ext}}");
    return (ctx) => {
      render(ctx);
    };
  }),
);

bench(
  "eta",
  createBench(() => {
    return (ctx) => {
      eta.renderString("<%=it.filename%>.<%=it.hash%>.<%=it.ext%>", ctx);
    };
  }),
);

bench(
  "eta (precompile)",
  createBench(() => {
    const render = eta
      .compile("<%=it.filename%>.<%=it.hash%>.<%=it.ext%>")
      .bind(eta);
    return (ctx) => {
      render(ctx);
    };
  }),
);

bench(
  "ejs",
  createBench(() => {
    return (ctx) => {
      ejs.render("<%=filename%>.<%=hash%>.<%=ext%>", ctx);
    };
  }),
);

bench(
  "ejs (precompile)",
  createBench(() => {
    const render = ejs.compile("<%=filename%>.<%=hash%>.<%=ext%>");
    return (ctx) => {
      render(ctx);
    };
  }),
);

await run({ format: "markdown" });
