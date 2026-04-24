/* state.js — shared mutable singleton */
export const State = {
    screen: 'start',
    room: null,
    isHost: false,
    myId: null,
    myName: '',
    myAvatar: '◉',
    myCharIdx: 0,
    players: {},
    matchStart: 0,
    matchEnd: 0,
    running: false,
};
