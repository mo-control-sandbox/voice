cmake_minimum_required(VERSION 3.21)

# Configures your project.
if(APPLE)
    project(native LANGUAGES CXX OBJCXX)
else()
    project(native LANGUAGES CXX)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PROJECT_ROOT_DIR ${CMAKE_CURRENT_SOURCE_DIR})
cmake_path(ABSOLUTE_PATH PROJECT_ROOT_DIR NORMALIZE)

# Imports the MōBrowser app configuration and setups the auxiliary targets, resources, etc.
# Important: Do not move this include above the project declaration.
include(${PROJECT_ROOT_DIR}/node_modules/@mobrowser/native/cmake/MoBrowser.cmake)

# The source files of your app.
if(APPLE)
    set(APP_SOURCES src/native/main.mm)
endif()

# Defines the main target of the application.
add_library(mobrowser_lib STATIC ${APP_SOURCES} ${GENERATED_SOURCES})

target_include_directories(mobrowser_lib PUBLIC
        ${PROJECT_SOURCE_DIR}/src/native/gen
        ${MOBROWSER_SDK_NATIVE_DIR}/include
        ${protobuf_SOURCE_DIR}/src
        ${protobuf_SOURCE_DIR}/third_party/utf8_range
        ${absl_SOURCE_DIR})

# macOS frameworks required by the native services.
if(APPLE)
    target_link_libraries(mobrowser_lib PRIVATE
            "-framework AVFoundation"
            "-framework AppKit"
            "-framework ApplicationServices"
            "-framework CoreGraphics"
            "-framework ServiceManagement"
            "-framework Speech")
endif()
