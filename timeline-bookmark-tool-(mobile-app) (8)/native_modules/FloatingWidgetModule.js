
import {NativeModules} from 'react-native';

const {FloatingWidgetModule} = NativeModules;

// It's a good practice to add an interface check
if (!FloatingWidgetModule) {
    throw new Error("The native module 'FloatingWidgetModule' is not available. Please check the native dependencies and linking.");
}

export default FloatingWidgetModule;
