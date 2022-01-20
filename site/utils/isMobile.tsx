import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
export const useIsMobile = () => {
  const { width: windowWidth } = useWindowDimensions();
  // const [isMobile, setIsMobile] = useState(true);
  // useEffect(() => {
  //   setIsMobile(windowWidth < 1000);
  // }, []);
  // console.log({ windowWidth });
  const isMobile = windowWidth < 1000;
  return isMobile;
};
