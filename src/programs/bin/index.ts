import { alias } from "./alias";
import { apt } from "./apt";
import { basename } from "./basename";
import { broadband } from "./broadband";
import { brew } from "./brew";
import { cat } from "./cat";
import { chatbox } from "./chatbox";
import { cd } from "./cd";
import { chown } from "./chown";
import { chmod } from "./chmod";
import { clear } from "./clear";
import { coffee } from "./coffee";
import { compact } from "./compact";
import { cp } from "./cp";
import { curl } from "./curl";
import { date } from "./date";
import { df } from "./df";
import { dig } from "./dig";
import { dirname } from "./dirname";
import { du } from "./du";
import { echo } from "./echo";
import { edit } from "./edit";
import { env } from "./env";
import { exportProgram } from "./export";
import { file } from "./file";
import { find } from "./find";
import { fortune } from "./fortune";
import { grep } from "./grep";
import { head } from "./head";
import { help } from "./help";
import { history } from "./history";
import { hostname } from "./hostname";
import { kill } from "./kill";
import { less } from "./less";
import { ln } from "./ln";
import { ls } from "./ls";
import { man } from "./man";
import { matrix } from "./matrix";
import { mkdir } from "./mkdir";
import { more } from "./more";
import { mv } from "./mv";
import { nano } from "./nano";
import { nmap } from "./nmap";
import { nslookup } from "./nslookup";
import { open } from "./open";
import { paint } from "./paint";
import { ping } from "./ping";
import { proof } from "./proof";
import { ps } from "./ps";
import { pwd } from "./pwd";
import { reboot } from "./reboot";
import { rm } from "./rm";
import { sh } from "./sh";
import { sheets } from "./sheets";
import { sleep } from "./sleep";
import { sort } from "./sort";
import { sprint } from "./sprint";
import { stat } from "./stat";
import { sublight } from "./sublight";
import { sudo } from "./sudo";
import { systemise } from "./systemise";
import { systemize } from "./systemize";
import { tail } from "./tail";
import { tar } from "./tar";
import { top } from "./top";
import { traceroute } from "./traceroute";
import { touch } from "./touch";
import { tree } from "./tree";
import { uname } from "./uname";
import { uniq } from "./uniq";
import { unzip } from "./unzip";
import { uptime } from "./uptime";
import { wc } from "./wc";
import { wget } from "./wget";
import { which } from "./which";
import { whoami } from "./whoami";
import { workslop } from "./workslop";
import { zip } from "./zip";
import type { Program } from "./types";

export const programs = [
  help,
  sh,
  ls,
  cd,
  pwd,
  cat,
  echo,
  open,
  date,
  env,
  uname,
  whoami,
  hostname,
  which,
  man,
  tree,
  find,
  grep,
  less,
  more,
  wc,
  head,
  tail,
  sort,
  uniq,
  file,
  stat,
  du,
  df,
  basename,
  dirname,
  ps,
  top,
  uptime,
  kill,
  history,
  alias,
  exportProgram,
  sudo,
  workslop,
  sprint,
  compact,
  systemise,
  systemize,
  sublight,
  proof,
  broadband,
  chatbox,
  ping,
  traceroute,
  dig,
  nslookup,
  curl,
  wget,
  brew,
  apt,
  paint,
  mkdir,
  rm,
  touch,
  cp,
  mv,
  ln,
  chmod,
  chown,
  tar,
  zip,
  unzip,
  nano,
  edit,
  sheets,
  coffee,
  nmap,
  clear,
  sleep,
  fortune,
  reboot,
  matrix
];

export const programRegistry = Object.fromEntries(programs.map((program) => [program.name, program])) as Record<string, Program>;
