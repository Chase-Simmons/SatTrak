import React from "react";

const SceneReady = ({ onReady }: { onReady: (r: boolean) => void }) => {
    React.useLayoutEffect(() => {
        onReady(true);
    }, [onReady]);
    return null;
}

export default SceneReady;
