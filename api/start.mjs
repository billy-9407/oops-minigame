import {endpoint,makeSession} from '../lib/server.mjs';
export default endpoint('POST',body=>makeSession(body));
